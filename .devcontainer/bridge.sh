#!/bin/bash
# .devcontainer/bridge.sh

TARGET_PORT=54322
HOST="host.docker.internal"

# Kill any existing socat processes to prevent port conflicts on restart
pkill socat || true

echo "Starting bridge: localhost:$TARGET_PORT -> $HOST:$TARGET_PORT"

# Run socat in the background, logging to /tmp for easy debugging
socat TCP-LISTEN:$TARGET_PORT,fork,bind=127.0.0.1 TCP:$HOST:$TARGET_PORT > /tmp/socat.log 2>&1 &

# Brief sleep to check if it crashed immediately
sleep 1
if ps aux | grep -v grep | grep "socat TCP-LISTEN:$TARGET_PORT" > /dev/null
then
    echo "Bridge started successfully."
else
    echo "Bridge failed to start. Check /tmp/socat.log"
    exit 1
fi
