#!/bin/bash
#
# Vite Server Health Check & Self-Healing Script
# Ensures the dev server is running and accessible
#

PORT=5173
MAX_RETRIES=30
RETRY_INTERVAL=2

echo "🔍 Checking Vite dev server on port $PORT..."

retry_count=0
while [ $retry_count -lt $MAX_RETRIES ]; do
  # Check if port is listening
  if nc -z localhost $PORT 2>/dev/null; then
    echo "✅ Vite server is running on port $PORT"
    
    # Verify HTTP response
    if curl -s -f http://localhost:$PORT/ > /dev/null 2>&1; then
      echo "✅ Vite server is responding correctly"
      echo "🌐 Access at: http://localhost:$PORT"
      exit 0
    else
      echo "⚠️  Port $PORT is open but not responding to HTTP requests"
    fi
  else
    echo "⏳ Vite not ready yet (attempt $((retry_count + 1))/$MAX_RETRIES), retrying in ${RETRY_INTERVAL}s..."
  fi
  
  sleep $RETRY_INTERVAL
  retry_count=$((retry_count + 1))
done

echo "❌ Vite server failed to start after $MAX_RETRIES attempts"
echo "💡 Try running: npm run dev"
exit 1
