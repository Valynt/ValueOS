#!/bin/sh
# build-trace.sh: Run a build, capture logs, and extract errors for robust tracing.
# Usage: ./build-trace.sh [build command]

LOGFILE=build-$(date +%Y%m%d-%H%M%S).log

if [ $# -eq 0 ]; then
  echo "Usage: $0 [build command]"
  exit 1
fi

echo "[build-trace] Running: $@"
"$@" 2>&1 | tee "$LOGFILE"

# Extract errors and warnings
ERRORS=$(grep -iE 'error|fail|exception|traceback' "$LOGFILE")
WARNINGS=$(grep -i warning "$LOGFILE")

if [ -n "$ERRORS" ]; then
  echo "\n[build-trace] ERRORS DETECTED:"
  echo "$ERRORS"
else
  echo "\n[build-trace] No errors detected."
fi

if [ -n "$WARNINGS" ]; then
  echo "\n[build-trace] WARNINGS DETECTED:"
  echo "$WARNINGS"
fi

echo "\n[build-trace] Full log saved to $LOGFILE"
