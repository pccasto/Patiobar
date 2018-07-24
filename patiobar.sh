#!/bin/bash

PIANOBAR_DIR=~pi
PIANOBAR_BIN=pianobar
PATIOBAR_DIR=~pi/Patiobar

case "$1" in

  start)
        # should this return the pid of pianobar?
        # right now need two calls - one to start, and one to pianobar-status
        # likely will leave it that way for now
        EXITSTATUS=0
        pushd . > /dev/null
        cd $PIANOBAR_DIR
        [[ 1 -eq $(screen -list | grep -c pianobar) ]] || screen -S pianobar -d -m $PIANOBAR_BIN
        EXITSTATUS=$?
        cd $PATIOBAR_DIR
        [[ 1 -eq $(screen -list | grep -c patiobar) ]] || screen -S patiobar -d -m node index.js
        EXITSTATUS=$(($? + $EXITSTATUS))
        popd > /dev/null
        exit "$EXITSTATUS"
        ;;

  testmode)
        EXITSTATUS=0
        pushd . > /dev/null
        cd $PIANOBAR_DIR
        [[ 1 -eq $(screen -list | grep -c pianobar) ]] || screen -S pianobar -d -m $PIANOBAR_BIN
        cd $PATIOBAR_DIR
#        [[ 1 -eq $(ps aux | grep -v grep | grep -c index.js) ]] || nodemon index.js
        [[ 1 -eq $(screen -list | grep -c patiobar) ]] && pkill -f "SCREEN -S patiobar"
        nodemon index.js
        # at this point we are interactive, so exitstatus is less meaningful
        EXITSTATUS=$(($? + $EXITSTATUS))
        popd > /dev/null
        exit "$EXITSTATUS"
        ;;

  stop)
        EXITSTATUS=0
        pkill -f "SCREEN -S pianobar"
        EXITSTATUS=$?
        pkill -f "SCREEN -S patiobar"
        EXITSTATUS=$(($? + $EXITSTATUS))
        exit $EXITSTATUS
        ;;
  stop-pianobar)
        EXITSTATUS=0
        pkill -f "SCREEN -S pianobar"
        EXITSTATUS=$?
        exit $EXITSTATUS
        ;;
  restart|force-reload)
        EXITSTATUS=0
        $0 stop || EXITSTATUS=1
        $0 start || EXITSTATUS==$(($? + $EXITSTATUS))
        exit $EXITSTATUS
        ;;
  status)
        # more of a list than a status, since this doesn't check values
        EXITSTATUS=0
        screen -list
        EXITSTATUS=$?
        exit $EXITSTATUS
        ;;
  status-pianobar)
        EXITSTATUS=0
        pb_pid=$(($(screen -list | grep pianobar | cut -d. -f1)))
        EXITSTATUS=$([[ $(($(screen -list | grep pianobar | cut -d. -f1))) -ge 1 ]] && echo 0 || echo 1)
        [[ $EXITSTATUS -eq 0 ]] && echo $pb_pid
        exit $EXITSTATUS
        ;;
  *)
        echo "Usage: $0 {start |stop | stop-pianobar |restart |status | status-pianobar | testmode }" >&2
        exit 3
        ;;
esac
