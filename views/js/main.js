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
	$("#stop").click(function() {
		$(this).children().toggleClass('glyphicon-pause glyphicon-play');
	});
}

function StationController($scope, socket) {
	socket.on('stations', function(msg) {
		msg.stations.pop();
		var s = [];

		for (i in msg.stations) {
			var array = msg.stations[i].split(":");
			var id = array[0];
			var name = array[1].replace(" Radio", "");

			s.push({name: name, id: id});
		}

		$scope.stations = s;
		document.getElementById("stations").className = "";
	});

	socket.on('start', function(msg) {
		// in case msg arrives without stationName set
		try {
			var stationName = msg.stationName.substr(0, msg.stationName.length - 6);
			$scope.stationName = stationName;
		}
		catch (err) {
		}
	});

	$scope.changeStation = function(stationId) {
		socket.emit('changeStation', { stationId: stationId });
	}
	document.getElementById("controls").className = "";
}

function SongController($scope, socket) {
	socket.on('start', function(msg) {
		document.getElementById("controls").className = "";
		var aa = 'on ' + msg.album + ' by ' + msg.artist;
		$scope.albumartist = aa;
		$scope.src = msg.coverArt;
		$scope.alt = msg.album;
		$scope.title = msg.title;
		$scope.rating = msg.rating;
		$scope.playing = msg.isplaying;
		alert($scope.playing);
		$scope.setPausePlayDisplay();

		if (msg.rating == 1) {
			document.getElementById("love").className = "btn btn-success pull-left";
		} else {
			document.getElementById("love").className = "btn btn-default pull-left";
		}
	});

	socket.on('stop', function(msg) {
		$scope.playing = false;
		var aa = 'pianobar turned off. click the play key to start';
		$scope.albumartist = aa;
		$scope.src = msg.coverArt;
		$scope.alt = 'pianobar off';
		$scope.title = msg.title;
		$scope.rating = msg.rating;
		document.getElementById("controls").className = "hidden-controls";
		//document.getElementById("stations").className = "hidden-controls";
	});

	socket.on('action', function(msg) {
		var action = msg.action;
		switch(action) {
		case 'P':
			alert('P - should start now');
			$scope.playing = true;
			$scope.setPausePlayDisplay();
			break;
		case 'S':
			alert('S - should stop now');
			$scope.playing = false;
			$scope.setPausePlayDisplay();
			break;
		default:
			//alert('unknown action: ' + action);
			// shouldn't care about other messages, but if we do, add handlers
			break;
		}

		//$(this).children().toggleClass('glyphicon-pause glyphicon-play');
		//$("#pauseplay").click();
	});

	$scope.sendCommand = function(action) {
		socket.emit('action', { action: action });
	}

//	$scope.togglePausePlay = function(pauseplay) {
//	  $scope.playing = false;
//	  $scope.pauseplayButton = $scope.subscribed ? 'Unsubscribe' : 'Subscribe';
	$scope.togglePausePlay= function() {
		$scope.playing ? $scope.sendCommand('S') : $scope.sendCommand('P');
		$scope.playing = !$scope.playing;
		$scope.setPausePlayDisplay()
	};

	$scope.setPausePlayDisplay= function() {
		if ($scope.playing) {
			document.getElementById('pauseplayICON').className = 'glyphicon glyphicon-pause';
		} else {
			//document.querySelector('#pauseplay span').className = 'glyphicon glyphicon-play';
			document.getElementById('pauseplayICON').className = 'glyphicon glyphicon-play';
		}
	};



//	$("#pauseplay").click(function() {
//		$(this).children().toggleClass('glyphicon-pause glyphicon-play');
		//$(this).children().ng-click="sendCommand('P');
//	});

	socket.on('lovehate', function(msg) {
		if (msg.rating == 1) {
			document.getElementById("love").className = "btn btn-success pull-left";
		}
	});


}
