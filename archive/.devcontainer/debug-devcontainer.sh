#!/bin/bash

# Devcontainer Debugging Script
# Based on comprehensive debugging guide for VS Code devcontainers
# This script automates the key debugging steps for devcontainer rebuild issues

set -e

echo "================================================================================="
echo "Devcontainer Debugging Script"
echo "================================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if running on host (not inside container)
check_environment() {
    log_info "Checking environment..."
    if [ -n "$CODESPACES" ] || [ -f "/.dockerenv" ]; then
        log_info "Running inside devcontainer - checking if services are started..."
        if command -v docker &> /dev/null; then
            log_info "Docker CLI available inside container"
            # Try to check services
            if docker ps --filter "label=com.docker.compose.project" &> /dev/null; then
                log_success "Devcontainer services appear to be running"
            else
                log_error "Devcontainer services not accessible"
                log_info "Try rebuilding the devcontainer or check the post-start script"
            fi
        else
            log_error "Docker CLI not available inside container"
            log_info "The devcontainer should have Docker CLI installed"
        fi
        return
    fi
    log_success "Running on host machine"
}

# Step 2: Install/verify devcontainer CLI
check_devcontainer_cli() {
    log_info "Checking devcontainer CLI..."
    if ! command -v devcontainer &> /dev/null; then
        log_warn "devcontainer CLI not found. Installing..."
        npm install -g @devcontainers/cli
        log_success "devcontainer CLI installed"
    else
        VERSION=$(devcontainer --version)
        log_success "devcontainer CLI found: $VERSION"
    fi
}

# Check Docker
check_docker() {
    log_info "Checking Docker..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker."
        exit 1
    fi

    CONTEXT=$(docker context show)
    log_info "Docker context: $CONTEXT"

    if ! docker info &> /dev/null; then
        log_error "Docker daemon not running or not accessible."
        exit 1
    fi
    log_success "Docker is running"
}

# Step 3: Run devcontainer up (CLI-only)
run_devcontainer_up() {
    log_info "Running devcontainer up (CLI-only)..."
    log_info "This will rebuild and start the container..."

    cd "$(dirname "$0")/.."  # Go to repo root (.devcontainer is subdirectory)

    if devcontainer up \
        --workspace-folder . \
        --log-level trace \
        --remove-existing-container; then
        log_success "devcontainer up completed successfully"
    else
        log_error "devcontainer up failed"
        exit 1
    fi
}

# Step 4: Extract docker-compose config
extract_compose_config() {
    log_info "Extracting final docker-compose configuration..."

    cd "$(dirname "$0")/.."  # Go to repo root

    # Find compose files (this is a heuristic - adjust as needed)
    COMPOSE_FILES=()
    if [ -f "docker-compose.yml" ]; then
        COMPOSE_FILES+=("-f" "docker-compose.yml")
    fi
    if [ -f ".devcontainer/docker-compose.yml" ]; then
        COMPOSE_FILES+=("-f" ".devcontainer/docker-compose.yml")
    fi
    if [ -f ".devcontainer/docker-compose.devcontainer.override.yml" ]; then
        COMPOSE_FILES+=("-f" ".devcontainer/docker-compose.devcontainer.override.yml")
    fi

    if [ ${#COMPOSE_FILES[@]} -eq 0 ]; then
        log_error "No docker-compose files found"
        return 1
    fi

    log_info "Using compose files: ${COMPOSE_FILES[*]}"

    echo "================================================================================="
    echo "FINAL DOCKER-COMPOSE CONFIG"
    echo "================================================================================="
    docker compose "${COMPOSE_FILES[@]}" config
    echo "================================================================================="
}

# Step 5: Manually build devcontainer image
build_image() {
    log_info "Manually building devcontainer image..."

    cd "$(dirname "$0")/.."  # Go to repo root

    COMPOSE_FILES=()
    if [ -f "docker-compose.yml" ]; then
        COMPOSE_FILES+=("-f" "docker-compose.yml")
    fi
    if [ -f ".devcontainer/docker-compose.yml" ]; then
        COMPOSE_FILES+=("-f" ".devcontainer/docker-compose.yml")
    fi
    if [ -f ".devcontainer/docker-compose.devcontainer.override.yml" ]; then
        COMPOSE_FILES+=("-f" ".devcontainer/docker-compose.devcontainer.override.yml")
    fi

    # Try to find the service name from devcontainer.json
    SERVICE_NAME="app"  # Default
    if [ -f ".devcontainer/devcontainer.json" ]; then
        SERVICE_NAME=$(grep -o '"service": *"[^"]*"' .devcontainer/devcontainer.json | sed 's/.*"service": *"\([^"]*\)".*/\1/' || echo "app")
    fi

    log_info "Building service: $SERVICE_NAME"

    if COMPOSE_PROFILES=devcontainer \
        docker compose "${COMPOSE_FILES[@]}" build --no-cache "$SERVICE_NAME"; then
        log_success "Image build completed successfully"
    else
        log_error "Image build failed"
        return 1
    fi
}

# Step 6: Verify image exists
verify_image() {
    log_info "Verifying devcontainer image exists..."

    # Try to find image name from devcontainer.json
    IMAGE_NAME=""
    if [ -f ".devcontainer/devcontainer.json" ]; then
        IMAGE_NAME=$(grep -o '"image": *"[^"]*"' .devcontainer/devcontainer.json | sed 's/.*"image": *"\([^"]*\)".*/\1/' || echo "")
    fi

    if [ -n "$IMAGE_NAME" ]; then
        log_info "Checking for image: $IMAGE_NAME"
        if docker images | grep -q "$IMAGE_NAME"; then
            log_success "Image $IMAGE_NAME exists locally"
        else
            log_error "Image $IMAGE_NAME not found locally - VS Code will try to pull it!"
            return 1
        fi
    else
        log_info "No specific image name found in devcontainer.json (using build: instead)"
    fi
}

# Step 7: Bring up without VS Code
bring_up_without_vscode() {
    log_info "Bringing up container without VS Code..."

    cd "$(dirname "$0")/.."  # Go to repo root

    COMPOSE_FILES=()
    if [ -f "docker-compose.yml" ]; then
        COMPOSE_FILES+=("-f" "docker-compose.yml")
    fi
    if [ -f ".devcontainer/docker-compose.yml" ]; then
        COMPOSE_FILES+=("-f" ".devcontainer/docker-compose.yml")
    fi
    if [ -f ".devcontainer/docker-compose.devcontainer.override.yml" ]; then
        COMPOSE_FILES+=("-f" ".devcontainer/docker-compose.devcontainer.override.yml")
    fi

    if COMPOSE_PROFILES=devcontainer \
        docker compose "${COMPOSE_FILES[@]}" up -d; then
        log_success "Container started successfully"

        # Show running containers
        echo "================================================================================="
        echo "RUNNING CONTAINERS"
        echo "================================================================================="
        docker ps --filter "label=com.docker.compose.project"

        # Try to attach to show internal state
        CONTAINER_ID=$(docker ps --filter "label=com.docker.compose.project" --format "{{.ID}}" | head -1)
        if [ -n "$CONTAINER_ID" ]; then
            log_info "Attaching to container $CONTAINER_ID..."
            echo "================================================================================="
            echo "CONTAINER INTERNAL CHECK"
            echo "================================================================================="
            docker exec "$CONTAINER_ID" sh -c "
                echo 'Node version:'; node -v || echo 'Node not found';
                echo 'PNPM version:'; pnpm -v || echo 'PNPM not found';
                echo 'DB host resolution:'; getent hosts db || getent hosts postgres || echo 'DB host not resolved';
                echo 'Current user:'; whoami;
                echo 'Working directory:'; pwd;
            "
        fi
    else
        log_error "Failed to start container"
        return 1
    fi
}

# Step 9: Nuclear reset
nuclear_reset() {
    log_warn "Performing nuclear reset - this will destroy all containers, volumes, and images!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Nuclear reset cancelled"
        return
    fi

    log_info "Stopping and removing all containers..."
    docker compose down -v 2>/dev/null || true
    docker rm -f $(docker ps -aq) 2>/dev/null || true

    log_info "Removing volumes..."
    docker volume prune -f

    log_info "Removing unused images..."
    docker image prune -f

    log_success "Nuclear reset completed"
}

# Main menu
show_menu() {
    echo "================================================================================="
    echo "Devcontainer Debugging Menu"
    echo "================================================================================="
    echo "1) Check environment and prerequisites"
    echo "2) Run devcontainer up (rebuild)"
    echo "3) Extract docker-compose config"
    echo "4) Manually build image"
    echo "5) Verify image exists"
    echo "6) Bring up without VS Code"
    echo "7) Nuclear reset (destructive!)"
    echo "8) Run all steps (1-6)"
    echo "9) Exit"
    echo "================================================================================="
    read -p "Choose an option (1-9): " choice
}

# Main execution
main() {
    while true; do
        show_menu
        case $choice in
            1)
                check_environment
                check_devcontainer_cli
                check_docker
                ;;
            2)
                run_devcontainer_up
                ;;
            3)
                extract_compose_config
                ;;
            4)
                build_image
                ;;
            5)
                verify_image
                ;;
            6)
                bring_up_without_vscode
                ;;
            7)
                nuclear_reset
                ;;
            8)
                log_info "Running all debugging steps..."
                check_environment
                check_devcontainer_cli
                check_docker
                run_devcontainer_up
                extract_compose_config
                build_image
                verify_image
                bring_up_without_vscode
                log_success "All steps completed"
                ;;
            9)
                log_info "Exiting..."
                exit 0
                ;;
            *)
                log_error "Invalid option"
                ;;
        esac
        echo
        read -p "Press Enter to continue..."
    done
}

# Run main function
main "$@"
