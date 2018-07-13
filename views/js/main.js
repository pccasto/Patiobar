"use strict";
var app = angular.module('patiobarApp', []);

// TODO - after a server stop/start, the station highlighting is lost
// ROOTCAUSE - fixed by issue with round-tripping the station name - it gets truncated to get rid of Radion, and then again..
// TODO - after a server stop the song playing controls still show up FIXED/TESTME
// TODO - after a server stop the playpause image doesn't always show up
// TODO - for warming up, we don't want to have the message 'click play to start'

//var socket = null;
app.factory('socket', function ($rootScope) {
  var socket = io.connect()	 ;//"", {
  return {
//	reconnect: function (eventName) {
//		console.log('socket.reconnect attempt');
//		//socket.io.reconnect();
//		socket.on('connect', function(){
//		console.log('reconnecting connected');
//			// anything here?
//		});
//	},

	on: function (eventName, callback) {
	  socket.on(eventName, function () {
		var args = arguments;
		$rootScope.$apply(function () {
		  callback.apply(socket, args);
		});
	  });
	},
	// TODO ... possibly needed to avoid memory leaks? still researching
	off: function off(event, callback) {
	   //We only have to check if the callback was provided and call socket.removeListener() or socket.removeAllListeners():
		if (typeof callback == 'function') {
			socket.removeListener(event, callback);
		} else {
			socket.removeAllListeners(event);
		}
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
	},
	removeAllListeners: function (eventName, callback) {
		  socket.removeAllListeners(eventName, function() {
			  var args = arguments;
			  $rootScope.$apply(function () {
				callback.apply(socket, args);
			  });
		  });
	  }
  };
});

function ProcessController($scope, socket) {
//app.controller('ProcessController',  ['$scope', socket, function ($scope, socket) {
	socket.on( 'connect', function () {
		console.log ('Connected back to server');
		//$scope.$root.$broadcast('server-process', 'resume');
	});

	$scope.process = function(action) {
		socket.emit('process', { action: action });
	}
// should just need this in one controllerv-but don't have service for broadcast yet
	socket.on( 'disconnect', function () {
		console.log ('Disconnected from server - dead or restarting?');
		socket.flush;
		//.title = "HACK HACK HACK - disconnected from patiobar server";

//		socket = io.connect();//	,{'forceNew': true });
//socket.io has some automatic retries at line 2815 -- need to see how to control
		//window.setTimeout( 'regen_socket()', 5000 );

	});

	$scope.$on('$destroy', function (event) {
		socket.removeAllListeners();
	});

//}]);
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
		$scope.pianobarRunning = true;
		// in case msg arrives without stationName set
		// turn this into a ternary
		try {
			var stationName = msg.stationName.replace(" Radio", "");
			$scope.stationName = stationName;
		}
		catch (err) {
			$scope.stationName = 'Unknown station';
		}
//console.log('station start', JSON.stringify(msg), $scope.stationName);
	});

	// stop message to station controller is different than stop to song controller
	socket.on('stop', function(msg) {
		$scope.stationName = "";
		//$scope.pianobarPlaying = false; // stations shouldn't care if song is playing or not
		$scope.pianobarRunning = false;
	});

	socket.on('server-process', function(msg) {
	  switch(msg) {
		case'outage' :
			$scope.stationName = "";
			$scope.pianobarRunning = false;
			break;
		case 'restore' :
			break;
		}
	});

// should just need this in one controller
	socket.on('disconnect', function () {
		console.log('station controller disconnecting');
		$scope.pianobarRunning=false;
	});

	$scope.changeStation = function(stationId) {
		socket.emit('changeStation', { stationId: stationId });
	}

	$scope.$on('$destroy', function (event) {
		socket.removeAllListeners();
	});
}

function SongController($scope, socket) {
	socket.on('start', function(msg) {
		var aa = 'on ' + msg.album + ' by ' + msg.artist;
		$scope.albumartist = aa;
		$scope.src = msg.coverArt;
		$scope.alt = msg.album;
		$scope.title = msg.title;
		$scope.rating = msg.rating;
		$scope.pianobarPlaying = msg.isplaying && msg.isrunning; // this should always be true for a start??
		$scope.pianobarRunning = msg.isrunning; // this should always be true for a start??
//console.log('song start', JSON.stringify(msg), $scope.pianobarPlaying);

// this can be changed to an angular ng-class
		if (msg.rating == 1) {
			document.getElementById("love").className = "btn btn-success pull-left";
		} else {
			document.getElementById("love").className = "btn btn-default pull-left";
		}
	});

	socket.on('server-process', function(msg) {
	console.log('got server-process message: ', msg)
	  switch(msg) {
		case'outage' :
			$scope.pianobarPlaying = false;
			var aa = 'PATIOBAR turned off. hopefully will restart soon';
			$scope.albumartist = aa;
			$scope.src = msg.coverArt;
			$scope.alt = 'pianobar off';
			$scope.title = msg.title;
			$scope.rating = msg.rating;
			break;
		case 'restore' :
			$scope.pianobarPlaying = true;
			break;
		}
	});

	socket.on('stop', function(msg) {
		$scope.pianobarPlaying = false;
		$scope.pianobarRunning = false;
		var aa = 'pianobar turned off. click the play key to start';
		$scope.albumartist = aa;
		$scope.src = msg.coverArt;
		$scope.alt = 'pianobar off';
		$scope.title = msg.title;
		$scope.rating = msg.rating;
//console.log("song stop",JSON.stringify(msg), $scope.pianobarPlaying);
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


//socket.on('disconnect', function () {
//	if(socket.io.connecting.indexOf(socket) === -1) {
//	  //you should renew token or do another important things before reconnecting
//	  socket.connect();
//	}
//});
	$scope.sendCommand = function(action) {
		socket.emit('action', { action: action });
	}

	$scope.togglePausePlay= function() {
		$scope.pianobarPlaying ? $scope.sendCommand('S') : $scope.sendCommand('P');
		// maybe not set this here, then change the broadcast response to send to originator as well
		// that would provide server feedback of the status? but gui button wouldn't seem responsive
		// maybe change to ? button while waiting
		$scope.pianobarPlaying = !$scope.pianobarPlaying;
	};

// this can be changed to an angular ng-class
	socket.on('lovehate', function(msg) {
		if (msg.rating == 1) {
			document.getElementById("love").className = "btn btn-success pull-left";
		}
	});
	socket.on('disconnect', function () {
		console.log('song controller disconnecting');
		$scope.title = "HACK HACK HACK - disconnected from patiobar server";
	});

	$scope.$on('$destroy', function (event) {
		socket.removeAllListeners();
	});
}
