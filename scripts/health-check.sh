#!/bin/bash

ENVIRONMENT=$1
PORT=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$PORT" ]; then
    echo "Usage: ./health-check.sh [environment] [port]"
    exit 1
fi

echo "🔍 Checking health of $ENVIRONMENT environment on port $PORT..."

for i in {1..30}; do
    if curl -f http://localhost:$PORT/healthz > /dev/null 2>&1; then
        echo "✅ Service is healthy!"
        exit 0
    fi
    echo "Attempt $i/30 - waiting for service..."
    sleep 2
done

echo "❌ Health check failed!"
exit 1
