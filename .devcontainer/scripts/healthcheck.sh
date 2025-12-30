#!/bin/bash
###############################################################################
# Dev Container Health Check
# Verifies container is healthy and ready for development
###############################################################################

set -e

# Exit codes
EXIT_SUCCESS=0
EXIT_FAILURE=1

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found"
    exit $EXIT_FAILURE
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm not found"
    exit $EXIT_FAILURE
fi

# Check Docker (optional)
if command -v docker &> /dev/null; then
    if ! docker ps &> /dev/null; then
        echo "WARNING: Docker daemon not accessible"
    fi
fi

# Check workspace directory
if [ ! -d "/workspace" ]; then
    echo "ERROR: Workspace directory not found"
    exit $EXIT_FAILURE
fi

echo "✓ Container is healthy"
exit $EXIT_SUCCESS
