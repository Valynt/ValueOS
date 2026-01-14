#!/usr/bin/env bash

# Common build functions for ValueOS build script
# Reduces code duplication and standardizes build patterns

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}🔨 $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Common build function
build_image() {
    local target="$1"
    local dockerfile="$2"
    local image_name="$3"
    local no_cache="${4:-false}"
    local push="${5:-false}"
    local dry_run="${6:-false}"
    local sign="${7:-false}"
    local verify="${8:-false}"
    local build_id="${9:-$(date +%s)}"

    log_info "Building $target image..."

    # Initialize metrics
    if [ -f "$SCRIPT_DIR/scripts/build-metrics.sh" ]; then
        "$SCRIPT_DIR/scripts/build-metrics.sh" init
        "$SCRIPT_DIR/scripts/build-metrics.sh" build-start "$build_id" "$target"
    fi

    load_digests "$build_id"
    get_git_info

    # Determine runtime digest based on target
    local runtime_digest
    case "$target" in
        "backend")
            runtime_digest="$ALPINE_DIGEST"
            ;;
        "frontend")
            runtime_digest="$NGINX_DIGEST"
            ;;
        "production")
            runtime_digest="$ALPINE_DIGEST"
            ;;
        *)
            log_error "Unknown target: $target"
            return 1
            ;;
    esac

    local build_args=(
        "--build-arg" "BUILDER_SHA256=$BUILDER_DIGEST"
        "--build-arg" "RUNTIME_SHA256=$runtime_digest"
        "--build-arg" "GIT_COMMIT=$GIT_COMMIT"
        "--build-arg" "GIT_BRANCH=$GIT_BRANCH"
        "--build-arg" "GIT_URL=$GIT_URL"
        "--build-arg" "BUILD_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        "--build-arg" "BUILD_PROFILE=${BUILD_PROFILE:-core}"
        "--build-arg" "APP_ENV=${APP_ENV:-dev}"
    )

    if [ "$no_cache" = true ]; then
        build_args+=("--no-cache")
    fi

    # Add labels
    build_args+=(
        "--label" "org.opencontainers.image.revision=$GIT_COMMIT"
        "--label" "org.opencontainers.image.source=$GIT_URL"
        "--label" "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        "--label" "org.opencontainers.image.version=${APP_VERSION:-latest}"
        "--label" "com.valueos.env=${APP_ENV:-dev}"
        "--label" "com.valueos.build_profile=${BUILD_PROFILE:-core}"
    )

    if [ "$dry_run" = true ]; then
        log_info "DRY RUN: Would execute:"
        echo "docker build ${build_args[*]} -t $image_name -f $dockerfile ."
        return 0
    fi

    # Execute build
    local build_start_time=$(date +%s)
    if docker build "${build_args[@]}" -t "$image_name" -f "$dockerfile" .; then
        local build_end_time=$(date +%s)
        local build_duration=$((build_end_time - build_start_time))

        log_success "$target image built successfully"

        # Record build completion metrics
        if [ -f "$SCRIPT_DIR/scripts/build-metrics.sh" ]; then
            "$SCRIPT_DIR/scripts/build-metrics.sh" build-end "$build_id" "$target" "success" "$build_duration"
            "$SCRIPT_DIR/scripts/build-metrics.sh" image-size "$image_name"
        fi

        if [ "$push" = true ]; then
            log_info "Pushing $target image..."
            if docker push "$image_name"; then
                log_success "$target image pushed"
            else
                log_error "$target push failed"
                if [ -f "$SCRIPT_DIR/scripts/build-metrics.sh" ]; then
                    "$SCRIPT_DIR/scripts/build-metrics.sh" build-end "$build_id" "$target" "failure" "$build_duration"
                fi
                return 1
            fi
        fi

        if [ "$sign" = true ]; then
            if sign_image "$image_name" "$verify"; then
                log_success "$target image signed successfully"
            else
                log_error "$target signing failed"
                return 1
            fi
        fi

        return 0
    else
        local build_end_time=$(date +%s)
        local build_duration=$((build_end_time - build_start_time))

        log_error "$target build failed"
        if [ -f "$SCRIPT_DIR/scripts/build-metrics.sh" ]; then
            "$SCRIPT_DIR/scripts/build-metrics.sh" build-end "$build_id" "$target" "failure" "$build_duration"
        fi
        return 1
    fi
}

# Load image digests from lockfile (moved from main script)
load_digests() {
    local build_id="${1:-}"

    if [ -n "$build_id" ] && [ -f "$SCRIPT_DIR/scripts/metrics-collector.sh" ]; then
        "$SCRIPT_DIR/scripts/metrics-collector.sh" stage_start "$build_id" load_digests
    fi

    local lockfile="$PROJECT_ROOT/ops/locks/images.lock.json"

    if [ ! -f "$lockfile" ]; then
        log_error "Image lockfile not found: $lockfile"
        log_info "Run './ops bootstrap' to create lockfile"
        exit 1
    fi

    if ! jq empty "$lockfile" > /dev/null 2>&1; then
        log_error "Image lockfile is corrupted: $lockfile"
        exit 1
    fi

    # Extract digests for build args
    BUILDER_DIGEST=$(jq -r '.images["mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm"].digest' "$lockfile" | cut -d'@' -f2)
    RUNTIME_DIGEST=$(jq -r '.images["node:22-bookworm-slim"].digest' "$lockfile" | cut -d'@' -f2)
    NGINX_DIGEST=$(jq -r '.images["nginx:bookworm"].digest' "$lockfile" | cut -d'@' -f2)
    ALPINE_DIGEST=$(jq -r '.images["node:22-alpine"].digest' "$lockfile" | cut -d'@' -f2)

    # Validate digests are available
    if [ -z "$BUILDER_DIGEST" ] || [ "$BUILDER_DIGEST" = "null" ]; then
        log_error "BUILDER_SHA256 not found in lockfile"
        exit 1
    fi

    if [ -z "$RUNTIME_DIGEST" ] || [ "$RUNTIME_DIGEST" = "null" ]; then
        log_error "RUNTIME_SHA256 not found in lockfile"
        exit 1
    fi

    if [ -z "$ALPINE_DIGEST" ] || [ "$ALPINE_DIGEST" = "null" ]; then
        log_error "ALPINE_SHA256 not found in lockfile"
        exit 1
    fi

    if [ -z "$NGINX_DIGEST" ] || [ "$NGINX_DIGEST" = "null" ]; then
        log_error "NGINX_SHA256 not found in lockfile"
        exit 1
    fi

    log_success "Loaded digests from lockfile"

    if [ -n "$build_id" ] && [ -f "$SCRIPT_DIR/scripts/metrics-collector.sh" ]; then
        "$SCRIPT_DIR/scripts/metrics-collector.sh" stage_end "$build_id" load_digests
    fi
}

# Get git information for labels (moved from main script)
get_git_info() {
    GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    GIT_URL=$(git config --get remote.origin.url 2>/dev/null || echo "unknown")

    # Clean up git URL for OCI label
    if [[ "$GIT_URL" == git@* ]]; then
        GIT_URL=$(echo "$GIT_URL" | sed 's/:/\//g' | sed 's/git@/https:\/\//')
    fi
}

# Sign image with cosign (moved from main script)
sign_image() {
    local image_ref="$1"
    local verify_after="${2:-false}"

    if ! command -v cosign > /dev/null 2>&1; then
        log_warning "cosign not found, skipping image signing"
        return 0
    fi

    log_info "Signing image: $image_ref"

    # Check if key exists
    local key_file="$PROJECT_ROOT/ops/keys/cosign.key"
    if [ ! -f "$key_file" ]; then
        log_warning "Cosign key not found, skipping image signing"
        return 0
    fi

    # Sign the image
    if cosign sign --key "$key_file" "$image_ref"; then
        log_success "Image signed successfully: $image_ref"

        # Verify if requested
        if [ "$verify_after" = true ]; then
            log_info "Verifying signature..."
            if cosign verify --key "$key_file" "$image_ref"; then
                log_success "Signature verified successfully"
            else
                log_error "Signature verification failed"
                return 1
            fi
        fi

        return 0
    else
        log_error "Failed to sign image: $image_ref"
        return 1
    fi
}

# Export functions for use in main script
export -f build_image
export -f load_digests
export -f get_git_info
export -f sign_image
