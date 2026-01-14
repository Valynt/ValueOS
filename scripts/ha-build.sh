#!/bin/bash
# HA Build and Deployment Script with Dual Registry Push
# Supports primary and secondary container registries for redundancy

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/config/ha-build.conf"

# Default configuration
DEFAULT_PRIMARY_REGISTRY="docker.io/valueos"
DEFAULT_SECONDARY_REGISTRY="ghcr.io/valueos"
DEFAULT_IMAGE_NAME="valueos-frontend"
DEFAULT_BUILD_PLATFORM="linux/amd64,linux/arm64"

# Load configuration
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
else
    PRIMARY_REGISTRY="$DEFAULT_PRIMARY_REGISTRY"
    SECONDARY_REGISTRY="$DEFAULT_SECONDARY_REGISTRY"
    IMAGE_NAME="$DEFAULT_IMAGE_NAME"
    BUILD_PLATFORM="$DEFAULT_BUILD_PLATFORM"
fi

# Generate version and tags
generate_tags() {
    local timestamp=$(date -u +'%Y%m%dT%H%M%SZ')
    local git_sha=$(git rev-parse --short HEAD 2>/dev/null || echo "no-git")
    local git_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "no-branch")
    
    # Version tags
    VERSION_TAG="v${timestamp}-${git_sha}"
    BRANCH_TAG="${git_branch}-latest"
    LKG_TAG="lkg"
    PRODUCTION_TAG="production"
    
    echo "Generated tags:"
    echo "  VERSION: $VERSION_TAG"
    echo "  BRANCH: $BRANCH_TAG"
    echo "  LKG: $LKG_TAG"
    echo "  PRODUCTION: $PRODUCTION_TAG"
}

# Build image with multiple platforms
build_image() {
    local tag=$1
    echo "Building multi-platform image: $tag"
    
    docker buildx build \
        --platform "$BUILD_PLATFORM" \
        --tag "$PRIMARY_REGISTRY/$IMAGE_NAME:$tag" \
        --tag "$SECONDARY_REGISTRY/$IMAGE_NAME:$tag" \
        --file "$PROJECT_ROOT/Dockerfile.ha-frontend" \
        --push \
        "$PROJECT_ROOT"
}

# Push to both registries with retry logic
push_to_registries() {
    local tag=$1
    local primary_image="$PRIMARY_REGISTRY/$IMAGE_NAME:$tag"
    local secondary_image="$SECONDARY_REGISTRY/$IMAGE_NAME:$tag"
    
    echo "Pushing to primary registry: $primary_image"
    retry 3 docker push "$primary_image"
    
    echo "Pushing to secondary registry: $secondary_image"
    retry 3 docker push "$secondary_image"
}

# Retry function for network operations
retry() {
    local retries=$1
    shift
    local count=0
    
    until "$@"; do
        exit_code=$?
        count=$((count + 1))
        if [[ $count -lt $retries ]]; then
            echo "Attempt $count/$retries failed. Retrying in 5 seconds..."
            sleep 5
        else
            echo "Failed after $retries attempts"
            return $exit_code
        fi
    done
}

# Health check for built image
health_check_image() {
    local image=$1
    echo "Running health check on: $image"
    
    # Pull and test image
    docker pull "$image"
    
    # Run container and check health endpoint
    local container_id=$(docker run -d --rm -p 8080:8080 "$image")
    
    # Wait for container to start
    sleep 10
    
    # Check health endpoint
    if curl -f -s "http://localhost:8080/health" > /dev/null; then
        echo "Health check passed for $image"
        docker stop "$container_id" 2>/dev/null || true
        return 0
    else
        echo "Health check failed for $image"
        docker stop "$container_id" 2>/dev/null || true
        return 1
    fi
}

# Update LKG tag only if health checks pass
update_lkg_tag() {
    local new_tag=$1
    
    echo "Updating LKG tag to: $new_tag"
    
    # Update LKG in primary registry
    docker tag "$PRIMARY_REGISTRY/$IMAGE_NAME:$new_tag" "$PRIMARY_REGISTRY/$IMAGE_NAME:$LKG_TAG"
    docker push "$PRIMARY_REGISTRY/$IMAGE_NAME:$LKG_TAG"
    
    # Update LKG in secondary registry
    docker tag "$SECONDARY_REGISTRY/$IMAGE_NAME:$new_tag" "$SECONDARY_REGISTRY/$IMAGE_NAME:$LKG_TAG"
    docker push "$SECONDARY_REGISTRY/$IMAGE_NAME:$LKG_TAG"
    
    echo "LKG tag updated successfully"
}

# Rollback to LKG if deployment fails
rollback_to_lkg() {
    echo "Rolling back to LKG tag..."
    
    # Pull LKG image from primary registry
    docker pull "$PRIMARY_REGISTRY/$IMAGE_NAME:$LKG_TAG"
    
    # Tag as production
    docker tag "$PRIMARY_REGISTRY/$IMAGE_NAME:$LKG_TAG" "$PRIMARY_REGISTRY/$IMAGE_NAME:$PRODUCTION_TAG"
    docker push "$PRIMARY_REGISTRY/$IMAGE_NAME:$PRODUCTION_TAG"
    
    # Update secondary registry
    docker tag "$SECONDARY_REGISTRY/$IMAGE_NAME:$LKG_TAG" "$SECONDARY_REGISTRY/$IMAGE_NAME:$PRODUCTION_TAG"
    docker push "$SECONDARY_REGISTRY/$IMAGE_NAME:$PRODUCTION_TAG"
    
    echo "Rollback to LKG completed"
}

# Cleanup old images
cleanup_old_images() {
    local keep_count=${1:-5}
    
    echo "Cleaning up old images, keeping last $keep_count"
    
    # Remove old images from primary registry
    docker run --rm \
        -e REGISTRY="$PRIMARY_REGISTRY" \
        -e IMAGE="$IMAGE_NAME" \
        -e KEEP_COUNT="$keep_count" \
        alpine:latest /bin/sh -c '
            apk add --no-cache curl jq
            echo "Cleaning up old images from $REGISTRY/$IMAGE"
            # Implementation depends on registry API
        '
}

# Main build and deployment function
main() {
    echo "Starting HA build and deployment process..."
    
    # Generate tags
    generate_tags
    
    # Build version image
    echo "Building version image: $VERSION_TAG"
    build_image "$VERSION_TAG"
    
    # Health check the new image
    if health_check_image "$PRIMARY_REGISTRY/$IMAGE_NAME:$VERSION_TAG"; then
        echo "Health check passed, updating tags..."
        
        # Update branch tag
        docker tag "$PRIMARY_REGISTRY/$IMAGE_NAME:$VERSION_TAG" "$PRIMARY_REGISTRY/$IMAGE_NAME:$BRANCH_TAG"
        docker push "$PRIMARY_REGISTRY/$IMAGE_NAME:$BRANCH_TAG"
        
        docker tag "$SECONDARY_REGISTRY/$IMAGE_NAME:$VERSION_TAG" "$SECONDARY_REGISTRY/$IMAGE_NAME:$BRANCH_TAG"
        docker push "$SECONDARY_REGISTRY/$IMAGE_NAME:$BRANCH_TAG"
        
        # Update LKG tag
        update_lkg_tag "$VERSION_TAG"
        
        # If this is main branch, also update production
        if [[ "$git_branch" == "main" || "$git_branch" == "master" ]]; then
            echo "Updating production tag..."
            docker tag "$PRIMARY_REGISTRY/$IMAGE_NAME:$VERSION_TAG" "$PRIMARY_REGISTRY/$IMAGE_NAME:$PRODUCTION_TAG"
            docker push "$PRIMARY_REGISTRY/$IMAGE_NAME:$PRODUCTION_TAG"
            
            docker tag "$SECONDARY_REGISTRY/$IMAGE_NAME:$VERSION_TAG" "$SECONDARY_REGISTRY/$IMAGE_NAME:$PRODUCTION_TAG"
            docker push "$SECONDARY_REGISTRY/$IMAGE_NAME:$PRODUCTION_TAG"
        fi
        
        echo "Build and deployment completed successfully!"
        echo "Images pushed:"
        echo "  Primary: $PRIMARY_REGISTRY/$IMAGE_NAME:$VERSION_TAG"
        echo "  Secondary: $SECONDARY_REGISTRY/$IMAGE_NAME:$VERSION_TAG"
        
    else
        echo "Health check failed, rolling back to LKG..."
        rollback_to_lkg
        exit 1
    fi
    
    # Cleanup old images
    cleanup_old_images 10
}

# Command line interface
case "${1:-build}" in
    build)
        main
        ;;
    rollback)
        rollback_to_lkg
        ;;
    cleanup)
        cleanup_old_images "${2:-5}"
        ;;
    health-check)
        health_check_image "${2:-$PRIMARY_REGISTRY/$IMAGE_NAME:$LKG_TAG}"
        ;;
    *)
        echo "Usage: $0 {build|rollback|cleanup|health-check}"
        echo "  build        - Build and deploy with health checks"
        echo "  rollback     - Rollback to LKG tag"
        echo "  cleanup      - Cleanup old images"
        echo "  health-check - Health check an image"
        exit 1
        ;;
esac
