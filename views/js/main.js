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

// factory created two 'start' handlers - perhaps better to combine them
//	socket.on('start', function(msg) {
//                var stationName = msg.stationName.substr(0, msg.stationName.length - 6);
//		$scope.stationName = stationName;
//        });

	$scope.changeStation = function(stationId) {
		socket.emit('changeStation', { stationId: stationId });
	}
        document.getElementById("controls").className = "";
}

function SongController($scope, socket) {
	socket.on('start', function(msg) {
		var aa = 'on ' + msg.album + ' by ' + msg.artist;
		$scope.albumartist = aa;
		$scope.src = msg.coverArt;
		$scope.alt = msg.album;
		$scope.title = msg.title;
		$scope.rating = msg.rating;

		if (msg.rating == 1) {
			document.getElementById("love").className = "btn btn-success pull-left";
		} else {
			document.getElementById("love").className = "btn btn-default pull-left";

		}
// combinining into one start handler
var stationName = msg.stationName.substr(0, msg.stationName.length - 6);
$scope.stationName = stationName;
	});

        socket.on('stop', function(msg) {
                var aa = 'pianobar turned off. click the play key to start';
                $scope.albumartist = aa;
                $scope.src = msg.coverArt;
                $scope.alt = 'pianobar off';
                $scope.title = msg.title;
                $scope.rating = msg.rating;
                document.getElementById("controls").className = "hidden-controls";
                document.getElementById("stations").className = "hidden-controls";
        });

	$scope.sendCommand = function(action) {
		socket.emit('action', { action: action });
	}

	$("#pauseplay").click(function() {
		$(this).children().toggleClass('glyphicon-pause glyphicon-play');
	});

	socket.on('lovehate', function(msg) {
		if (msg.rating == 1) {
			document.getElementById("love").className = "btn btn-success pull-left";
		}
	});


}
