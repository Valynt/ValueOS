#!/bin/bash
# post-build-validation.sh - Health checks after build

set -e

echo "Running post-build validation..."

# Check if dist directories exist
if [ ! -d "dist" ] && [ ! -d "apps/valynt-app/dist" ]; then
    echo "ERROR: No build output found"
    exit 1
fi

# Check for required files
if [ -d "apps/valynt-app/dist" ]; then
    if [ ! -f "apps/valynt-app/dist/index.html" ]; then
        echo "ERROR: Missing index.html in build output"
        exit 1
    fi
fi

# Validate environment variables (if .env.example exists)
if [ -f ".env.example" ]; then
    echo "Validating environment variables..."
    # Add checks here
fi

# Checksum validation (example)
if command -v sha256sum >/dev/null 2>&1; then
    echo "Generating build checksums..."
    find dist -type f -exec sha256sum {} \; > build-checksums.txt 2>/dev/null || true
fi

echo "Post-build validation passed!"
