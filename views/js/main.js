"use strict";
var app = angular.module('patiobarApp', []);

app.factory('socket', function ($rootScope) {
  var socket = io.connect();
  return {
	on: function (eventName, callback) {
	  socket.on(eventName, function () {
		var args = arguments;
		$rootScope.$apply(function () {
		  callback.apply(socket, args);
		});
	  });
	},
	emit: function (eventName, data, callback) {
	  socket.emit(eventName, data, function () {
		var args = arguments;
		$rootScope.$apply(function () {
		  if (callback) {
			callback.apply(socket, args);
		  }
		});
	  })
	}
  };
});

function ProcessController($scope, socket) {
	$scope.process = function(action) {
		socket.emit('process', { action: action });
	}
}

function StationController($scope, socket) {
	socket.on('stations', function(msg) {
		msg.stations.pop();
		var s = [];

		for (var i in msg.stations) {
			var array = msg.stations[i].split(":");
			var id = array[0];
			var name = array[1].replace(" Radio", "");

			s.push({name: name, id: id});
		}

		$scope.stations = s;
	});

	socket.on('start', function(msg) {
		// in case msg arrives without stationName set
		$scope.pianobarPlaying = true;
		try {
			var stationName = msg.stationName.substr(0, msg.stationName.length - 6);
			$scope.stationName = stationName;
		}
		catch (err) {
			$scope.stationName = 'Unknown station';
		}
	});

	socket.on('stop', function(msg) {
		$scope.stationName = "";
		$scope.pianobarPlaying = false;
	});

	$scope.changeStation = function(stationId) {
		socket.emit('changeStation', { stationId: stationId });
	}
}

function SongController($scope, socket) {
	socket.on('start', function(msg) {
		var aa = 'on ' + msg.album + ' by ' + msg.artist;
		$scope.albumartist = aa;
		$scope.src = msg.coverArt;
		$scope.alt = msg.album;
		$scope.title = msg.title;
		$scope.rating = msg.rating;
		$scope.pianobarPlaying = msg.isplaying;
		//alert($scope.pianobarPlaying);

// this can be changed to an angular ng-class
		if (msg.rating == 1) {
			document.getElementById("love").className = "btn btn-success pull-left";
		} else {
			document.getElementById("love").className = "btn btn-default pull-left";
		}
	});

	socket.on('stop', function(msg) {
		$scope.pianobarPlaying = false;
		var aa = 'pianobar turned off. click the play key to start';
		$scope.albumartist = aa;
		$scope.src = msg.coverArt;
		$scope.alt = 'pianobar off';
		$scope.title = msg.title;
		$scope.rating = msg.rating;
	});

	socket.on('action', function(msg) {
		var action = msg.action;
		switch(action) {
		case 'P':
			//alert('P - should start now');
			$scope.pianobarPlaying = true;
			break;
		case 'S':
			//alert('S - should stop now');
			$scope.pianobarPlaying = false;
			break;
		default:
			//alert('unknown action: ' + action);
			// shouldn't care about other messages, but if we do, add handlers
			break;
		}
	});

	socket.on( 'disconnect', function () {
	    alert( 'disconnected from server' );
	    window.setTimeout( 'app.connect()', 5000 );
	});

	$scope.sendCommand = function(action) {
		socket.emit('action', { action: action });
	}

	$scope.togglePausePlay= function() {
		$scope.pianobarPlaying ? $scope.sendCommand('S') : $scope.sendCommand('P');
		$scope.pianobarPlaying = !$scope.pianobarPlaying;
	};

// this can be changed to an angular ng-class
	socket.on('lovehate', function(msg) {
		if (msg.rating == 1) {
			document.getElementById("love").className = "btn btn-success pull-left";
		}
	});

}
