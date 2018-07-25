/* jshint esversion:6, node: true */
"use strict";

// TODO - real logging framework...
// add timestamps in front of log messages
require('console-stamp')(console, {
	metadata: function () {
		return ('[' + process.memoryUsage().rss + ']');
	},
	colors: {
		stamp: 'yellow',
		label: 'white',
		metadata: 'green'
	}
});

const
	express = require('express'),
	app = require('express')(),
	server = require('http').createServer(app),
	io = require('socket.io')(server),
	fs = require('fs'),
	child_process = require("child_process"),

	fifo = process.env.PIANOBAR_FIFO || 'ctl',
	listenPort = process.env.PATIOBAR_PORT || 3000,

	patiobarCtl    = process.env.PIANOBAR_START  || process.env.HOME + '/Patiobar/patiobar.sh',
	pianobarStart  = process.env.PIANOBAR_START  || process.env.HOME + '/Patiobar/patiobar.sh start',
	pianobarStop   = process.env.PIANOBAR_STOP   || process.env.HOME + '/Patiobar/patiobar.sh stop-pianobar',
	pianobarStatus = process.env.PIANOBAR_STATUS || process.env.HOME + '/Patiobar/patiobar.sh status-pianobar',

	pianobarOffImageURL = 'images/On_Off.png',

	currentSongFile = process.env.HOME + '/.config/pianobar/currentSong',
	pausePlayTouchFile = process.env.HOME + '/.config/pianobar/pause'; // perhaps this should move to ./config/patiobar/pause

// Routing
app.use(express.static(__dirname + '/views'));

function isPianobarPlaying() {
	return !fs.existsSync(pausePlayTouchFile);
}

// need to use a command to really check
function isPianobarRunning() {
	var pb_status = child_process.spawnSync(patiobarCtl, ['status-pianobar']);
	return pb_status.status == 0 ? true : false;
}

function readCurrentSong() {
	var currentSong = fs.readFileSync(currentSongFile).toString();
	var songTemplate = { artist: '', title: '', album: '',
		coverArt: pianobarOffImageURL, rating: '',
		stationName: '', isplaying: false, isrunning: false };

	if (currentSong) {
		var a = currentSong.split(',,,');
			if (a[0] == "PIANOBAR_STOPPED") {
		 return (songTemplate);
		} else {
			return ({ artist: a[0], title: a[1], album: a[2], coverArt: a[3], rating: a[4], stationName: a[5], isplaying: isPianobarPlaying() , isrunning: isPianobarRunning()});
		}
	} else {
		console.error('No current song file');
		return(songTemplate);
	}
}

function clearFIFO() {
	try {
		child_process.spawnSync("dd", ["if=", fifo , "iflag=nonblock", "of=/dev/null"]);
	}
	catch (err) {
		console.log('EAGAIN type errors happen often (resource not available): ' + err.message);
	}
}

//function systemSync(cmd, verbose, quiet){
//	return child_process.exec(cmd, (err, stdout, stderr) => {
//	  console.log('should be quiet:', quiet);
//		if (err) {
//			console.log("Command | Error", cmd, err);
//		}
//	verbose && console.log('stdout is:' + stdout);
//	verbose && console.log('stderr is:' + stderr);
//	})
//}

function ProcessCTL(action) {
	var songTemplate = { artist: '', title: '', album: '',
			coverArt: pianobarOffImageURL, rating: '',
			stationName: '', isplaying: false, isrunning: false };
	switch(action) {
		case 'start':
			if (isPianobarRunning()) {
				console.log("Pianobar is already running");
				return;
			}
			console.log('Starting Pianobar');
			// pianobar starts in the running state, unless work is done to force it otherwise
			// but wait for the first start message to change the playing from false to true
			var songStatus = Object.assign(songTemplate, { title: 'Warming up', isrunning: true});
			//io.emit('start', {...songTemplate, ...{ title: 'Warming up', isrunning: true}});
			io.emit('start', songStatus);

			try {
				// minimize any junk commands introduced while system was offline
				clearFIFO();
				if (!isPianobarPlaying()) PidoraCTL('S');  // if paused, stay paused after restart
				var pb_start = child_process.spawnSync(patiobarCtl, ['start']);
				if (pb_start.status != 0) throw pb_start.error;
			}
			catch(err) {
				console.log(err);
				return;
			}
			break;

	  case 'stop':
			io.emit('stop', songTemplate);
			if (!isPianobarRunning()) {
				console.log("Pianobar is not running, so no need to stop");
				return;
			}
			console.log('Stopping Pianobar');
//		try {
			clearFIFO();
			PidoraCTL('q');
			fs.writeFile(process.env.HOME + '/.config/pianobar/currentSong', 'PIANOBAR_STOPPED,,,,', function (err) {
				if (err) {
				  console.log(err);
				  return;
				} else {
					console.log('Stop entry made in currentSong file!');
				}
			});
//		}
//		catch (err) {
//			console.log('Error in stopping Pianobar: ' + err.message);
//			return;
//		}
			break;

	  default:
			console.log('Unrecognized process action: ' + action);
			break;
	}
}

function PidoraCTL(action) {
	// this might be a blocking write, which is problematic if patiobar is not reading...
	fs.open(fifo, 'w', '0644', function(error, fd) {
		if (error) {
		if (fd) {
			fs.close(fd);
		}
		console.log('Error opening fifo: ' + error);
		return;
		}

		var buf = new Buffer.from(action);
		fs.write(fd, buf, 0, action.length, null, function(error, written, buffer) {
			if (fd) {
				fs.close(fd, function(err) {
					if (err) console.log('Error closing fifo: ' + error);
				});
			}
			if (error) {
				console.log('Error writing to fifo: ' + error);
			} else {
				if (written == action.length) {
					console.log(action.trim('\n') + ' has been written successfully!');
				} else {
					console.log('Error: Only wrote ' + written + ' out of ' + action.length + ' bytes to fifo.');
				}
			}
		});
	});
}

// TODO consider making this more responsive if add/rename station is added
// TODO consider making this a remembered global variable
function readStations() {
	var list = fs.readFileSync(process.env.HOME + '/.config/pianobar/stationList').toString().split("\n");
	return {'stations': list};
}

var socketlist = [];

io.on('connection', function(socket) {
	// remotePort is often Wrong (or at least seemed to be with old library)
	var user_id = socket.request.connection.remoteAddress + ':' +socket.request.connection.remotePort + ' | ' + socket.id;
	// make this value available in exit block, etc.
	socket.user_id = user_id;

	socketlist.push(socket);
	console.log('A user connected', user_id);

	// disconnect seems to fire.  Not sure about close... TODO remove if needed.
	socket.on('close', function () {
		console.log('socket closed', user_id );
		var client_index = socketlist.splice(socketlist.indexOf(socket), 1);
		if (client_index == -1)
			console.log("Socket was not in active list when disconnecting: ", user_id);
		socket.disconnect(0);
	});

	socket.emit('start', readCurrentSong());
	socket.emit('stations', readStations());

	socket.on('disconnect', function(){
		console.log('User disconnected (client closed)', user_id);
		var client_index = socketlist.splice(socketlist.indexOf(socket), 1);
		if (client_index == -1)
			console.log("Socket was not in active list when disconnecting: ", user_id);
		socket.disconnect(0);
	});

	socket.on('process', function (data) {
		console.log('User request:', data, user_id);
		var action = data.action;
		ProcessCTL(action);
	});

	// nothing calls this yet, but planning ahead
	socket.on('query', function (data) {
		console.log('User request:', data, user_id);
		switch( data.query ) {
			case 'currrentSong' :
				socket.emit('query', readCurrentSong());
				break;
			case 'currentStation' :
				socket.emit('query', readCurrentSong());
				break;
			case 'allStations' :
				socket.emit('query', readStations());
				break;
			case '*' :
				console.log('Unknown request');
				break;
			}
	});

	socket.on('action', function (data) {
		console.log('User request:', data, user_id);
		var action = data.action.substring(0, 1);
		// rebroadcast changes so all clients know the action was taken
		io.emit('action', { action: action});
		PidoraCTL(action);
		eventcmd_extension(action);
	});

	// if only pianobar supported more events....
	function eventcmd_extension (action) {
		switch (action) {
			case 'S' :
				fs.closeSync(fs.openSync(pausePlayTouchFile, 'a')); // touch the pause file
				break;
			case 'P' :
				// Do not care about errors (particularly file didn't exist)
				fs.unlink(pausePlayTouchFile, (err) => {});
				break;
			}
	}

	socket.on('changeStation', function (data) {
		console.log('User request:', data, user_id);
		var stationId = data.stationId;
		var cmd = 's' + stationId + '\n';
		PidoraCTL(cmd);
	});

	// triggered by eventcmd.sh or other external drivers
	app.post('/start', function(request, response){
		var artist = request.query.artist;
		var title = request.query.title;
		var album = request.query.album;
		var coverArt = request.query.coverArt;
		var rating = request.query.rating;
		var stationName = request.query.stationName;
		io.emit('stations', readStations() );
		io.emit('start', { artist: artist, title: title,  album: album, coverArt: coverArt,rating: rating, stationName: stationName, isplaying: isPianobarPlaying(), isrunning: isPianobarRunning() });
		if (!isPianobarPlaying()) PidoraCTL('S');  // if paused, stay paused after station change
		response.send(request.query);
	});

	app.post('/lovehate', function(request, response) {
		var rating = request.query.rating;
		io.emit('lovehate', { rating: rating });
	});

});

function exitHandler(options, err) {
	socketlist.forEach(function(socket) {
		console.log("Exit - disconnecting: ", socket.user_id, socket.connected);
		// we could attempt to send a message to the socket to let the clients know the server is offline
		// we really don't want to send a disconnect if we expect the client to keep trying once we come up
		// socket.disconnect(0); // sending this would cause clients to not attempt to reconnect
		// so let tcp cleanup happen naturally from the client side
	});
	socketlist =[]; // because exitHandler gets called twice - by the interupt, and then by the exit

	if (options.cleanup) console.log('clean');
	if (err) console.log(err.stack);
	if (options.exit) {
		console.log("Caught interrupt signal");
		process.exit();
	}
}

process.on('exit', exitHandler.bind(null,{cleanup:true}));

['SIGINT', 'SIGUSR1', 'uncaughtException', 'SIGTERM'].forEach((eventType) => {
	process.on(eventType, exitHandler.bind(null, {exit:true}));
});
['SIGUSR2'].forEach((eventType) => { // allow nodemon to restart, rather than end process
	process.on(eventType, exitHandler.bind(null, {exit:false}));
});
// audit info for connected clients
process.on('SIGHUP', function() {
	console.log("Connection Status (from HUP): ", io.sockets.sockets.length);
	socketlist.forEach(function(socket) {
		console.log(" status: ", socket.user_id, socket.connected);
	});
});


// this should be after all other code is in place
server.listen(listenPort);
