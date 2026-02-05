#!/bin/bash

# ValueOS Docker Compose Loader
# Runs appropriate docker-compose configuration based on environment
# Uses the new consolidated configuration structure

set -euo pipefail

# Refuse to run scripts stack if devcontainer containers are present
if docker ps -q --filter "name=devcontainer_" | grep -q .; then
    echo "Refusing: devcontainer stack is running. Use VS Code Dev Containers stack only."
    exit 1
fi

# Refuse to run scripts stack from inside a Dev Container
if [[ -f "/.dockerenv" ]] && [[ -n "${REMOTE_CONTAINERS+x}" ]]; then
    echo "Refusing: running inside Dev Container. Use devcontainer compose stack."
    exit 1
fi

# Configuration
CONFIG_DIR="config/docker"
ENVIRONMENTS_DIR="config/environments"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage
show_usage() {
    echo "ValueOS Docker Compose Loader"
    echo ""
    echo "Usage: $0 [ENVIRONMENT] [COMMAND] [OPTIONS]"
    echo ""
    echo "Environments:"
    echo "  development    Development environment (default)"
    echo "  staging       Staging environment"
    echo "  production    Production environment"
    echo "  test          Test environment"
    echo ""
    echo "Commands:"
    echo "  up            Start services (default)"
    echo "  down          Stop and remove services"
    echo "  restart       Restart services"
    echo "  logs          Show logs"
    echo "  ps            Show running services"
    echo "  exec          Execute command in service"
    echo "  build         Build or rebuild services"
    echo "  pull          Pull service images"
    echo "  clean         Clean up containers and volumes"
    echo ""
    echo "Options:"
    echo "  --profile PROFILE    Use specific Docker profile"
    echo "  --service SERVICE   Target specific service"
    echo "  --verbose           Show detailed output"
    echo "  --dry-run           Show command without executing"
    echo ""
    echo "Examples:"
    echo "  $0 development up                    # Start development services"
    echo "  $0 production up --profile observability  # Start production with monitoring"
    echo "  $0 staging logs --service backend      # Show backend logs in staging"
    echo "  $0 test down --clean                   # Stop and clean test environment"
}

# Load environment variables
load_environment() {
    local env=$1

    # Load base environment first
    if [[ -f "$ENVIRONMENTS_DIR/base.env" ]]; then
        log "Loading base environment variables..."
        set -a
        source "$ENVIRONMENTS_DIR/base.env"
        set +a
    else
        log_error "Base environment file not found: $ENVIRONMENTS_DIR/base.env"
        exit 1
    fi

    # Load environment-specific overrides
    if [[ -f "$ENVIRONMENTS_DIR/$env.env" ]]; then
        log "Loading $env environment variables..."
        set -a
        source "$ENVIRONMENTS_DIR/$env.env"
        set +a
    else
        log_warning "Environment file not found: $ENVIRONMENTS_DIR/$env.env (using base only)"
    fi

    # Export NODE_ENV explicitly
    export NODE_ENV=$env
}

# Build docker-compose command
build_docker_command() {
    local env=$1
    local cmd=$2
    local service=$3
    local profile=$4
    local verbose=$5
    local dry_run=$6

    # Base command with base configuration
    local docker_cmd="docker-compose -f $CONFIG_DIR/docker-compose.base.yml"

    # Add environment-specific configuration
    if [[ -f "$CONFIG_DIR/docker-compose.$env.yml" ]]; then
        docker_cmd="$docker_cmd -f $CONFIG_DIR/docker-compose.$env.yml"
    else
        log_warning "Environment-specific compose file not found: $CONFIG_DIR/docker-compose.$env.yml"
    fi

    # Add profile if specified
    if [[ -n "$profile" ]]; then
        docker_cmd="$docker_cmd --profile $profile"
    fi

    # Add command
    docker_cmd="$docker_cmd $cmd"

    # Add service if specified
    if [[ -n "$service" ]]; then
        docker_cmd="$docker_cmd $service"
    fi

    # Add verbose flag
    if [[ "$verbose" == "true" ]]; then
        docker_cmd="$docker_cmd --verbose"
    fi

    echo "$docker_cmd"
}

# Validate environment
validate_environment() {
    local env=$1

    case $env in
        development|staging|production|test)
            return 0
            ;;
        *)
            log_error "Invalid environment: $env"
            log_error "Valid environments: development, staging, production, test"
            show_usage
            exit 1
            ;;
    esac
}

# Validate command
validate_command() {
    local cmd=$1

    case $cmd in
        up|down|restart|logs|ps|exec|build|pull|clean)
            return 0
            ;;
        *)
            log_error "Invalid command: $cmd"
            log_error "Valid commands: up, down, restart, logs, ps, exec, build, pull, clean"
            show_usage
            exit 1
            ;;
    esac
}

# Main execution
main() {
    local environment="development"
    local command="up"
    local service=""
    local profile=""
    local verbose="false"
    local dry_run="false"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            development|staging|production|test)
                environment="$1"
                shift
                ;;
            up|down|restart|logs|ps|exec|build|pull|clean)
                command="$1"
                shift
                ;;
            --profile)
                profile="$2"
                shift 2
                ;;
            --service)
                service="$2"
                shift 2
                ;;
            --verbose)
                verbose="true"
                shift
                ;;
            --dry-run)
                dry_run="true"
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Validate inputs
    validate_environment "$environment"
    validate_command "$command"

    # Load environment variables
    load_environment "$environment"

    # Build docker command
    local docker_cmd
    docker_cmd=$(build_docker_command "$environment" "$command" "$service" "$profile" "$verbose" "$dry_run")

    # Show what we're doing
    log "Environment: $environment"
    log "Command: $command"
    [[ -n "$service" ]] && log "Service: $service"
    [[ -n "$profile" ]] && log "Profile: $profile"

    if [[ "$dry_run" == "true" ]]; then
        log "Dry run - command would be:"
        echo "$docker_cmd"
        exit 0
    fi

    # Execute command
    log "Executing: $docker_cmd"

    case $command in
        clean)
            log "Cleaning up containers and volumes..."
            eval "$docker_cmd down -v --remove-orphans"
            docker system prune -f
            log_success "Cleanup completed"
            ;;
        exec)
            if [[ -z "$service" ]]; then
                log_error "Service required for exec command"
                exit 1
            fi
            eval "$docker_cmd"
            ;;
        *)
            if eval "$docker_cmd"; then
                log_success "Command completed successfully"
            else
                log_error "Command failed"
                exit 1
            fi
            ;;
    esac
}

# Run main function with all arguments
main "$@"
