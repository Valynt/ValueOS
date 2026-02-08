#!/bin/sh
# Usage: ./trace-build.sh [build command]
# Runs a build, captures logs, and extracts errors/warnings for robust tracing.

LOGFILE=build-$(date +%Y%m%d-%H%M%S).log

if [ $# -eq 0 ]; then
  echo "Usage: $0 [build command]"
  exit 1
fi

echo "[trace-build] Running: $@"
"$@" 2>&1 | tee "$LOGFILE"

# Extract errors and warnings
ERRORS=$(grep -iE 'error|fail|exception|traceback' "$LOGFILE")
WARNINGS=$(grep -i warning "$LOGFILE")

if [ -n "$ERRORS" ]; then
  echo "\n[trace-build] ERRORS DETECTED:"
  echo "$ERRORS"
else
  echo "\n[trace-build] No errors detected."
fi

if [ -n "$WARNINGS" ]; then
  echo "\n[trace-build] WARNINGS DETECTED:"
  echo "$WARNINGS"
fi

echo "\n[trace-build] Full log saved to $LOGFILE"
