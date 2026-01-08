#!/bin/bash
#
# Vite Server Restart Script
# Automatically restarts the Vite dev server if it crashes
#

PORT=5173
CHECK_INTERVAL=10
LOG_FILE="/tmp/vite.log"

echo "🔄 Starting Vite server monitor..."
echo "📝 Logs: $LOG_FILE"

while true; do
  # Check if Vite is running
  if ! nc -z localhost $PORT 2>/dev/null; then
    echo "⚠️  Vite server not responding on port $PORT"
    echo "🔄 Restarting Vite server..."
    
    # Kill any existing Vite processes
    pkill -f "vite --host" 2>/dev/null
    sleep 1
    
    # Start Vite in background
    cd /workspaces/ValueOS
    nohup npm run dev > "$LOG_FILE" 2>&1 &
    
    echo "✅ Vite server restarted"
    echo "⏳ Waiting for server to be ready..."
    sleep 5
  fi
  
  sleep $CHECK_INTERVAL
done
