#!/bin/bash
# Build all agents with BuildKit cache optimization
# Usage: ./build-agents.sh [agent-name] [--push] [--no-cache]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BUILD_MATRIX="${PROJECT_ROOT}/pragmatic-reproducibility/agent-build-matrix.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check dependencies
check_dependencies() {
    local missing=()

    command -v docker >/dev/null 2>&1 || missing+=("docker")
    command -v jq >/dev/null 2>&1 || missing+=("jq")
    command -v node >/dev/null 2>&1 || missing+=("node")

    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing[*]}"
        exit 1
    fi

    # Check Docker BuildKit
    if ! docker buildx version >/dev/null 2>&1; then
        log_error "Docker BuildKit not available. Please install docker-buildx."
        exit 1
    fi
}

# Load build configuration from matrix
load_config() {
    if [ ! -f "$BUILD_MATRIX" ]; then
        log_error "Build matrix not found: $BUILD_MATRIX"
        exit 1
    fi

    NODE_VERSION=$(jq -r '.buildConfig.nodeVersion' "$BUILD_MATRIX")
    PNPM_VERSION=$(jq -r '.buildConfig.pnpmVersion' "$BUILD_MATRIX")
    REGISTRY=$(jq -r '.buildConfig.registry' "$BUILD_MATRIX")

    log_info "Build Configuration:"
    log_info "  Node: ${NODE_VERSION}"
    log_info "  pnpm: ${PNPM_VERSION}"
    log_info "  Registry: ${REGISTRY}"
}

# Get list of agents to build
get_agents() {
    local specific_agent="${1:-}"

    if [ -n "$specific_agent" ]; then
        if jq -e ".agents[\"${specific_agent}\"]" "$BUILD_MATRIX" >/dev/null 2>&1; then
            echo "$specific_agent"
        else
            log_error "Agent '${specific_agent}' not found in build matrix"
            exit 1
        fi
    else
        jq -r '.agents | keys[]' "$BUILD_MATRIX"
    fi
}

# Build a single agent
build_agent() {
    local agent_name="$1"
    local push="${2:-false}"
    local no_cache="${3:-false}"

    log_info "Building agent: ${agent_name}"

    # Get agent configuration
    local agent_config
    agent_config=$(jq -c ".agents[\"${agent_name}\"]" "$BUILD_MATRIX")

    local package_path=$(echo "$agent_config" | jq -r '.packagePath')
    local expose_port=$(echo "$agent_config" | jq -r '.exposePort')
    local lifecycle_stage=$(echo "$agent_config" | jq -r '.lifecycleStage')

    log_info "  Package: ${package_path}"
    log_info "  Port: ${expose_port}"
    log_info "  Stage: ${lifecycle_stage}"

    # Check if Dockerfile exists
    local dockerfile="${PROJECT_ROOT}/${package_path}/Dockerfile"
    if [ ! -f "$dockerfile" ]; then
        log_warn "Dockerfile not found at ${dockerfile}, generating from template..."
        generate_dockerfile "$agent_name" "$package_path"
    fi

    # Build arguments
    local build_args=(
        "--build-arg" "AGENT_NAME=${agent_name}"
        "--build-arg" "NODE_VERSION=${NODE_VERSION}"
        "--build-arg" "PNPM_VERSION=${PNPM_VERSION}"
        "--build-arg" "EXPOSE_PORT=${expose_port}"
    )

    # Cache configuration
    local cache_args=(
        "--cache-from" "type=registry,ref=${REGISTRY}/${agent_name}-cache:latest"
        "--cache-to" "type=registry,ref=${REGISTRY}/${agent_name}-cache:latest,mode=max"
    )

    if [ "$no_cache" = "true" ]; then
        cache_args=("--no-cache")
    fi

    # Tags
    local tags=(
        "--tag" "${REGISTRY}/${agent_name}:latest"
    )

    if [ -n "${GITHUB_SHA:-}" ]; then
        tags+=("--tag" "${REGISTRY}/${agent_name}:${GITHUB_SHA}")
    fi

    if [ -n "${GITHUB_REF_NAME:-}" ]; then
        tags+=("--tag" "${REGISTRY}/${agent_name}:${GITHUB_REF_NAME}")
    fi

    # Platform
    local platform_args=("--platform" "linux/amd64,linux/arm64")

    # Build command
    local build_cmd=(
        "docker" "buildx" "build"
        "${build_args[@]}"
        "${cache_args[@]}"
        "${tags[@]}"
        "${platform_args[@]}"
        "-f" "$dockerfile"
        "--label" "agent.name=${agent_name}"
        "--label" "agent.lifecycle_stage=${lifecycle_stage}"
        "--label" "agent.version=${GITHUB_SHA:-local}"
        "--label" "build.date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    )

    if [ "$push" = "true" ]; then
        build_cmd+=("--push")
    else
        build_cmd+=("--load")
    fi

    build_cmd+=("${PROJECT_ROOT}")

    # Execute build
    log_info "Executing: ${build_cmd[*]}"

    if "${build_cmd[@]}"; then
        log_success "Successfully built ${agent_name}"

        # Scan for vulnerabilities (optional)
        if command -v trivy >/dev/null 2>&1; then
            log_info "Scanning ${agent_name} for vulnerabilities..."
            trivy image --severity HIGH,CRITICAL "${REGISTRY}/${agent_name}:latest" || true
        fi

        return 0
    else
        log_error "Failed to build ${agent_name}"
        return 1
    fi
}

# Generate Dockerfile from template
generate_dockerfile() {
    local agent_name="$1"
    local package_path="$2"

    local template="${PROJECT_ROOT}/packages/agents/base/Dockerfile.template"
    local output="${PROJECT_ROOT}/${package_path}/Dockerfile"

    if [ ! -f "$template" ]; then
        log_error "Dockerfile template not found: $template"
        exit 1
    fi

    # Create directory if it doesn't exist
    mkdir -p "$(dirname "$output")"

    # Copy template (in a real implementation, this would use a templating engine)
    cp "$template" "$output"

    log_info "Generated Dockerfile at ${output}"
}

# Validate all Dockerfiles against template
validate_dockerfiles() {
    log_info "Validating Dockerfiles against template..."

    local errors=0
    local template="${PROJECT_ROOT}/packages/agents/base/Dockerfile.template"

    for agent_name in $(get_agents); do
        local package_path=$(jq -r ".agents[\"${agent_name}\"].packagePath" "$BUILD_MATRIX")
        local dockerfile="${PROJECT_ROOT}/${package_path}/Dockerfile"

        if [ ! -f "$dockerfile" ]; then
            log_warn "Dockerfile missing for ${agent_name}"
            ((errors++))
            continue
        fi

        # Basic validation - check for required ARG
        if ! grep -q "ARG AGENT_NAME" "$dockerfile"; then
            log_error "Dockerfile for ${agent_name} missing AGENT_NAME ARG"
            ((errors++))
        fi

        # Check for non-root user
        if ! grep -q "USER agent" "$dockerfile"; then
            log_error "Dockerfile for ${agent_name} missing non-root user configuration"
            ((errors++))
        fi

        log_success "Dockerfile for ${agent_name} is valid"
    done

    if [ $errors -gt 0 ]; then
        log_error "Validation failed with ${errors} errors"
        return 1
    fi

    log_success "All Dockerfiles are valid"
    return 0
}

# Main function
main() {
    local agent_name=""
    local push=false
    local no_cache=false
    local validate_only=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --push)
                push=true
                shift
                ;;
            --no-cache)
                no_cache=true
                shift
                ;;
            --validate)
                validate_only=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [agent-name] [--push] [--no-cache] [--validate]"
                echo ""
                echo "Arguments:"
                echo "  agent-name    Specific agent to build (default: all)"
                echo "  --push        Push images to registry after build"
                echo "  --no-cache    Disable BuildKit cache"
                echo "  --validate    Only validate Dockerfiles, don't build"
                exit 0
                ;;
            *)
                if [ -z "$agent_name" ]; then
                    agent_name="$1"
                fi
                shift
                ;;
        esac
    done

    # Run checks
    check_dependencies
    load_config

    # Validate only mode
    if [ "$validate_only" = "true" ]; then
        validate_dockerfiles
        exit $?
    fi

    # Build agents
    local failed=0
    local built=0

    for agent in $(get_agents "$agent_name"); do
        if build_agent "$agent" "$push" "$no_cache"; then
            ((built++))
        else
            ((failed++))
        fi
    done

    # Summary
    echo ""
    log_info "Build Summary:"
    log_info "  Built: ${built}"
    log_info "  Failed: ${failed}"

    if [ $failed -gt 0 ]; then
        exit 1
    fi
}

# Run main
main "$@"
