"use strict";

// TODO - real logging framework...
// add timestamps in front of log messages
require('console-stamp')(console, '[HH:MM:ss.l]');
var util = require('util');
console.log = function log()
{
   fs.writeSync(this._stdout.fd, util.format.apply(null,arguments) + "\n");
}

const
	express = require('express'),
	app = require('express')(),
	server = require('http').createServer(app),
	io = require('socket.io')(server),
	fs = require('fs'),
	child_process = require("child_process"),

	fifo = process.env.PIANOBAR_FIFO || 'ctl',
	listenPort = process.env.PATIOBAR_PORT || 3000,

	patiobarCtl	   = process.env.PIANOBAR_START	  || process.env.HOME + '/Patiobar/patiobar.sh',
	pianobarStart  = process.env.PIANOBAR_START	  || process.env.HOME + '/Patiobar/patiobar.sh start',
	pianobarStop   = process.env.PIANOBAR_STOP	  || process.env.HOME + '/Patiobar/patiobar.sh stop-pianobar',
	pianobarStatus = process.env.PIANOBAR_STATUS  || process.env.HOME + '/Patiobar/patiobar.sh status-pianobar',

	pianobarOffImageURL = 'images/On_Off.png',

	currentSongFile = process.env.HOME + '/.config/pianobar/currentSong',
	pausePlayTouchFile = process.env.HOME + '/.config/pianobar/pause'; // perhaps this should move to ./config/patiobar/pause

//app.use(express.static('views/images')); // might not need this if we reference the on_off.png differently

// Routing
app.use(express.static(__dirname + '/views'));

function isPianobarPlaying() {
	return !fs.existsSync(pausePlayTouchFile);
}

// need to use a command to really check
function isPianobarRunning() {
	var pb_status = child_process.spawnSync(patiobarCtl, ['status-pianobar'])
	return pb_status.status == 0 ?	true : false;

//	console.log("running is:", running);
//	return running;
}

function readCurrentSong() {
	var currentSong = fs.readFileSync(currentSongFile).toString()

	if (currentSong) {
	   var a = currentSong.split(',,,');
	   // console.log(a);
	   if (a[0] == "PIANOBAR_STOPPED") {
		 ProcessCTL('stop');
	   } else {
		 io.emit('start', { artist: a[0], title: a[1], album: a[2], coverArt: a[3], rating: a[4], stationName: a[5], isplaying: isPianobarPlaying() , isrunning: isPianobarRunning()});
	   }
	}
}

function clearBuffer() {
	try {
		child_process.spawnSync("dd" ["if=", fifo , "iflag=nonblock", "of=/dev/null"])
		//systemSync("dd if=" + fifo + " iflag=nonblock of=/dev/null", false, true)
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
	switch(action) {
	  case 'start':
		if (isPianobarRunning()) {
			console.log("Pianobar is already running");
			return;
		}
		console.log('Starting Pianobar');
		// pianobar starts in the running state, unless work is done to force it otherwise
		// but wait for the first start message to change the playing from false to true
		io.emit('stop', { artist: ' ', title: 'Warming up', album: ' ', coverArt: pianobarOffImageURL, rating: '', stationName: 'pending', isplaying: false, isrunning: false});

		// minimize any junk commands introduced while system was offline

		// now would be the time to send a 'S' if we wanted to start paused
		try {
			clearBuffer();
			var pb_start = child_process.spawnSync(patiobarCtl, ['start'])
			if (pb_start.status != 0) throw pb_start.error
		}
		catch(err) {
			console.log(err);
			return;
		}
		break;

	  case 'stop':
		if (!isPianobarRunning()) {
			console.log("Pianobar is not running, so no need to stop");
			return;
		}
		console.log('Stopping Pianobar');
		try {
			clearBuffer();
			console.log('Buffer should now be cleared');

			PidoraCTL('q');
			io.emit('stop', { artist: '', title: '', album: '', coverArt: pianobarOffImageURL, rating: '', stationName: '', isplaying: false, isrunning: false });
			fs.writeFile(process.env.HOME + '/.config/pianobar/currentSong', 'PIANOBAR_STOPPED,,,,', function (err) {
				if (err) {
				  console.log(err);
				  return;
				} else {
					console.log('Stop entry made in currentSong file!');
				}
			});
		}
		catch (err) {
			console.log('Error in stopping Pianobar: ' + err.message);
			return;
		}
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

function readStations() {
	var stations = fs.readFileSync(process.env.HOME + '/.config/pianobar/stationList').toString().split("\n");

	io.emit('stations', { stations: stations });
}

var socketlist = [];

io.on('connection', function(socket) {
	var user_id = socket.request.connection.remoteAddress + ':' +socket.request.connection.remotePort + ' | ' + socket.id;
	// make this value available in exit block, etc.
	socket['user_id'] = user_id;

	socketlist.push(socket);
	console.log('A user connected: ' + user_id);

	// disconnect seems to fire.  Not sure about close... TODO remove if needed.
	socket.on('close', function () {
	  console.log('socket closed: ', user_id );
		var client_index = socketlist.splice(socketlist.indexOf(socket), 1);
		if (client_index == -1)
			console.log("Socket was not in active list when disconnecting: ", user_id);
		socket.disconnect(0);
	});

	readCurrentSong();
	readStations();

	socket.on('disconnect', function(){
		console.log('User disconnected (client closed): ', user_id);
		var client_index = socketlist.splice(socketlist.indexOf(socket), 1);
		if (client_index == -1)
			console.log("Socket was not in active list when disconnecting: ", user_id);
		socket.flush;
		socket.disconnect(0);
	});

	socket.on('process', function (data) {
		var action = data.action
		ProcessCTL(action);
	});

	socket.on('action', function (data) {
		var action = data.action.substring(0, 1);
		// rebroadcast changes - like 'pause' - but avoid circular
		socket.broadcast.emit('action', { action: action});
		PidoraCTL(action);
		event_cmd_extension(action);
	});

	function event_cmd_extension (action) {
		switch (action) {
			case 'S' :
				fs.closeSync(fs.openSync(pausePlayTouchFile, 'a')); // touch the pause file
				break;
			case 'P' :
				// Do not care about errors (file didn't exist)
				fs.unlink(pausePlayTouchFile, (err) => {});
				break;
			}
	}

	socket.on('changeStation', function (data) {
		var stationId = data.stationId;
		var cmd = 's' + stationId + '\n';
		PidoraCTL(cmd);
	});

	app.post('/start', function(request, response){
		var artist = request.query.artist;
		var title = request.query.title;
		var album = request.query.album;
		var coverArt = request.query.coverArt;
		var rating = request.query.rating;
		var stationName = request.query.stationName;
		readStations();
		io.emit('start', { artist: artist, title: title, coverArt: coverArt, album: album, rating: rating, stationName: stationName, isplaying: isPianobarPlaying(), isrunning: isPianobarRunning() });
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
		// so we really don't want to send a disconnect if we expect the client to keep trying once we come up
		// let tcp cleanup happen naturally
//		socket.disconnect(0);
// we should send a message to the socket to let the clients know the server is offline
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

[`SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`].forEach((eventType) => {
  process.on(eventType, exitHandler.bind(null, {exit:true}));
})

process.on(`SIGHUP`, function() {
	console.log("Connection Status (from HUP): ", io.sockets.sockets.length);
	socketlist.forEach(function(socket) {
		console.log("	 status: ", socket.user_id, socket.connected);
	});
});


// this should be after all other code is in place
server.listen(listenPort);
