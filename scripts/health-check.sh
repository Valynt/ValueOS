#!/bin/bash

# Enhanced health check script with proper endpoint polling
# Usage: ./health-check.sh <url> [timeout_seconds] [interval_seconds] [expected_status]

set -euo pipefail

URL="${1:-}"
TIMEOUT="${2:-300}"  # 5 minutes default
INTERVAL="${3:-10}"  # 10 seconds default
EXPECTED_STATUS="${4:-200}"  # Expected HTTP status code

if [ -z "$URL" ]; then
    echo "Error: URL is required"
    echo "Usage: $0 <url> [timeout_seconds] [interval_seconds] [expected_status]"
    exit 1
fi

echo "🔍 Starting health check for $URL"
echo "   Timeout: ${TIMEOUT}s, Interval: ${INTERVAL}s, Expected status: ${EXPECTED_STATUS}"

start_time=$(date +%s)
end_time=$((start_time + TIMEOUT))
attempt=1

while [ $(date +%s) -lt $end_time ]; do
    echo "Attempt $attempt - Checking health endpoint..."

    # Try to curl the endpoint and capture status code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 --retry 2 --retry-delay 1 "$URL" 2>/dev/null || echo "000")

    if [ "$status_code" = "$EXPECTED_STATUS" ]; then
        echo "✅ Health check passed! Status: $status_code"
        exit 0
    else
        echo "❌ Health check failed. Status: $status_code (expected: $EXPECTED_STATUS)"
        echo "   Retrying in ${INTERVAL} seconds..."
        sleep "$INTERVAL"
        ((attempt++))
    fi
done

echo "❌ Health check timed out after ${TIMEOUT} seconds"
echo "   Final status check: $(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null || echo "unreachable")"
exit 1
