#!/bin/bash
###############################################################################
# Docker-based Hermetic Build Script
#
# Runs the build process inside a Docker container for consistency across
# environments. Uses Docker BuildKit for faster, parallel builds.
###############################################################################

set -euo pipefail

# Enable Docker BuildKit
export DOCKER_BUILDKIT=1

# Build context directory (current directory by default)
BUILD_CONTEXT="${BUILD_CONTEXT:-.}"

# Docker image tag
IMAGE_TAG="${IMAGE_TAG:-valueos-build:latest}"

# Output directory for build artifacts
OUTPUT_DIR="${OUTPUT_DIR:-./dist}"

# Build the Docker image
echo "🏗️  Building Docker image for hermetic build..."
docker build \
  --target export \
  --tag "$IMAGE_TAG" \
  --file Dockerfile.build \
  "$BUILD_CONTEXT"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Extract build artifacts from the container
echo "📦 Extracting build artifacts..."
docker run --rm "$IMAGE_TAG" tar -cf - . | tar -xf - -C "$OUTPUT_DIR"

echo "✅ Hermetic build completed successfully!"
echo "📁 Build artifacts available in: $OUTPUT_DIR"
