const C = require('constants');
const net = require('net');

var express = require('express');
var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');

var fifo = process.env.PIANOBAR_FIFO || 'ctl';
var listenPort = process.env.PATIOBAR_PORT || 3000;

var pianobarStart = process.env.PIANOBAR_START || process.env.HOME + '/Patiobar/patiobar.sh start';
var pianobarStop  = process.env.PIANOBAR_STOP  || process.env.HOME + '/Patiobar/patiobar.sh stop-pianobar';

app.use(express.static('views/images'));
var pianobarOffImageURL = '../On_Off.png';

server.listen(listenPort);

// Routing
app.use(express.static(__dirname + '/views'));

function readCurrentSong() {
	var currentSong = fs.readFileSync(process.env.HOME + '/.config/pianobar/currentSong').toString()

	if (currentSong) {
	   var a = currentSong.split(',,,');
	   console.log(a);
           if (a[0] == "PIANOBAR_STOPPED") {
              ProcessCTL('stop');
           } else {
	      io.emit('start', { artist: a[0], title: a[1], album: a[2], coverArt: a[3], rating: a[4], stationName: a[5] });
           }
	}

}

function ProcessCTL(action) {
        switch(action) {
          case 'start':
	    console.log('Starting Pianobar');
            try {
              require('child_process').execSync("cat", [fifo]); //clear old buffer
              console.log('Buffer should be cleared');
              require('child_process').execSync(pianobarStart);
              console.log('Pianobar process should have started');
            }
            catch (err) {
              console.log('Error in starting Pianobar: ' + err.message);
              return;
            }
            break;

          case 'stop':
	    console.log('Stopping Pianobar');
	      PidoraCTL('q');
	      io.emit('stop', { artist: '', title: '', album: '', coverArt: pianobarOffImageURL, rating: '', stationName: ''  });
              fs.writeFile(process.env.HOME + '/.config/pianobar/currentSong', 'PIANOBAR_STOPPED,,,,', function (err) {
                if (err) return console.log(err);
                console.log('Stop entry made in currentSong file!');
              });
           break;

          default:
            console.log('Unrecognized process action: ' + action);
            break;
         }
}


function PidoraCTL(action) {
	fs.open(fifo, 'w', 0644, function(error, fd) {
	  if (error) {
	    if (fd) {
	      fs.close(fd);
	    }
	    console.log('Error opening fifo: ' + error);
	    return;
	  }

	  buf = new Buffer.from(action);
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
	        console.log(action.trim() + ' has been written successfully!');
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


io.on('disconnect', function(socket){
	if (socket) {
	  console.log('a user disconnected from:' + socket.request.connection.remoteAddress);
	} else {
	  console.log('a user disconnected');
	}
  });

io.on('connection', function(socket) {
	console.log('a user connected from: ' + socket.request.connection.remoteAddress);
	readCurrentSong();
	readStations();

	socket.on('process', function (data) {
		var action = data.action
		ProcessCTL(action);
	});

	socket.on('action', function (data) {
		var action = data.action.substring(0, 1)
		PidoraCTL(action);
	});

	socket.on('changeStation', function (data) {
		var stationId = data.stationId;
		var cmd = 's' + stationId + '\n';
		PidoraCTL(cmd);
	});

app.post('/start', function(request, response){
	artist = request.query.artist;
	title = request.query.title;
	album = request.query.album;
	coverArt = request.query.coverArt;
	rating = request.query.rating;
	stationName = request.query.stationName;
	io.emit('start', { artist: artist, title: title, coverArt: coverArt, album: album, rating: rating, stationName: stationName });
	readStations();
	response.send(request.query);

});

app.post('/lovehate', function(request, response) {
	rating = request.query.rating;

	io.emit('lovehate', { rating: rating });

	console.log(request.query);
});


});
