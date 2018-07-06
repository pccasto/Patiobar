#!/bin/bash

PIANOBAR_DIR=~pi
PIANOBAR_BIN=pianobar
PATIOBAR_DIR=~pi/Patiobar

case "$1" in
  start)
        EXITSTATUS=0
        pushd . > /dev/null
        cd $PIANOBAR_DIR
        [[ 1 -eq $(screen -list | grep -c pianobar) ]] || screen -S pianobar -d -m $PIANOBAR_BIN
        cd $PATIOBAR_DIR
        [[ 1 -eq $(screen -list | grep -c patiobar) ]] || screen -S patiobar -d -m node index.js
        popd > /dev/null
        exit "$EXITSTATUS"
        ;;

  test)
        EXITSTATUS=0
        pushd . > /dev/null
        cd $PIANOBAR_DIR
        [[ 1 -eq $(screen -list | grep -c pianobar) ]] || screen -S pianobar -d -m PIANOBAR_BIN
        cd $PATIOBAR_DIR
        [[ 1 -eq $(ps aux | grep -v grep | grep -c index.js) ]] || nodemon index.js
        popd > /dev/null
        exit "$EXITSTATUS"
        ;;

  stop)
        EXITSTATUS=0
        pkill -f "SCREEN -S pianobar"
        pkill -f "SCREEN -S patiobar"
        exit $EXITSTATUS
        ;;
  stop-pianobar)
        EXITSTATUS=0
        pkill -f "SCREEN -S pianobar"
        exit $EXITSTATUS
        ;;
  restart|force-reload)
        EXITSTATUS=0
        $0 stop || EXITSTATUS=1
        $0 start || EXITSTATUS=1
        exit $EXITSTATUS
        ;;
  status)
        EXITSTATUS=0
        screen -list
        exit $EXITSTATUS
        ;;
  status-pianobar)
        echo screen -list
        [[ $(screen -list | grep -c pianobar) -eq 1 ]]
        rc=$?
        echo $rc
        exit $rc
        ;;
  *)
        echo "Usage: $0 {start |stop | stop-pianobar |restart |status | status-pianobar }" >&2
        exit 3
        ;;
esac
