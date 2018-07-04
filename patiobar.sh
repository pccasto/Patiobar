#!/bin/bash
case "$1" in
  start)
        EXITSTATUS=0
        pushd . > /dev/null
        cd ~pi
        [[ 1 -eq $(screen -list | grep -c pianobar) ]] || screen -S pianobar -d -m pianobar
        cd Patiobar
        [[ 1 -eq $(screen -list | grep -c patiobar) ]] || screen -S patiobar -d -m nodejs index.js
        popd > /dev/null
        exit "$EXITSTATUS"
        ;;
  test)
        EXITSTATUS=0
        pushd . > /dev/null
        cd ~pi
        [[ 1 -eq $(screen -list | grep -c pianobar) ]] || screen -S pianobar -d -m pianobar
        cd Patiobar
        [[ 1 -eq $(screen -list | grep -c patiobar) ]] ||  nodejs index.js
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
  *)
        echo "Usage: $0 {start |stop |restart |status }" >&2
        exit 3
        ;;
esac
