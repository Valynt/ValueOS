#!/bin/bash

# Blue-Green Deployment Script
# Performs zero-downtime deployments using Caddy's dynamic configuration
# Switches traffic between blue and green environments

set -e

# Configuration
CADDY_ADMIN_URL="${CADDY_ADMIN_URL:-http://localhost:2019}"
BLUE_PORT=8001
GREEN_PORT=8002
HEALTH_CHECK_TIMEOUT=60
TRAFFIC_SWITCH_TIMEOUT=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN: $1${NC}"
}

# Check if Caddy admin API is available
check_caddy_api() {
    if ! curl -s -f "${CADDY_ADMIN_URL}/config/" > /dev/null; then
        error "Caddy admin API not available at ${CADDY_ADMIN_URL}"
        exit 1
    fi
}

# Get current active environment
get_active_env() {
    # Query Caddy config to see which upstream is active
    local config
    config=$(curl -s "${CADDY_ADMIN_URL}/config/")

    if echo "$config" | grep -q "localhost:${BLUE_PORT}"; then
        echo "blue"
    elif echo "$config" | grep -q "localhost:${GREEN_PORT}"; then
        echo "green"
    else
        echo "unknown"
    fi
}

# Check health of a service
check_health() {
    local port=$1
    local timeout=${2:-30}

    log "Checking health of service on port ${port}..."

    local start_time=$(date +%s)
    while true; do
        if curl -s -f "http://localhost:${port}/healthz" > /dev/null 2>&1; then
            log "Service on port ${port} is healthy"
            return 0
        fi

        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $elapsed -gt $timeout ]; then
            error "Service on port ${port} failed health check after ${timeout} seconds"
            return 1
        fi

        sleep 2
    done
}

# Deploy to inactive environment
deploy_to_inactive() {
    local active_env=$(get_active_env)
    local target_env
    local target_port

    case $active_env in
        blue)
            target_env="green"
            target_port=$GREEN_PORT
            ;;
        green)
            target_env="blue"
            target_port=$BLUE_PORT
            ;;
        *)
            # First deployment, default to blue
            target_env="blue"
            target_port=$BLUE_PORT
            ;;
    esac

    log "Deploying to ${target_env} environment (port ${target_port})"

    # Here you would typically build and deploy your application
    # For this example, we'll assume the service is already running on the target port
    # In a real scenario, you'd do: docker-compose up -d ${target_env}-service

    # Wait for the new deployment to be healthy
    if ! check_health $target_port $HEALTH_CHECK_TIMEOUT; then
        error "New deployment failed health checks"
        exit 1
    fi

    echo $target_env
}

# Switch traffic to new environment
switch_traffic() {
    local new_env=$1
    local new_port

    case $new_env in
        blue)
            new_port=$BLUE_PORT
            ;;
        green)
            new_port=$GREEN_PORT
            ;;
        *)
            error "Invalid environment: $new_env"
            exit 1
            ;;
    esac

    log "Switching traffic to ${new_env} environment (port ${new_port})"

    # Update Caddy configuration dynamically
    local config='{
        "apps": {
            "http": {
                "servers": {
                    "srv0": {
                        "listen": [":80"],
                        "routes": [
                            {
                                "match": {"host": ["localhost"]},
                                "handle": [
                                    {
                                        "handler": "reverse_proxy",
                                        "upstreams": [
                                            {"dial": "localhost:'$new_port'"}
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        }
    }'

    # Apply new configuration
    if curl -s -X POST -H "Content-Type: application/json" \
         -d "$config" "${CADDY_ADMIN_URL}/load" > /dev/null; then
        log "Traffic successfully switched to ${new_env}"
    else
        error "Failed to switch traffic to ${new_env}"
        exit 1
    fi

    # Wait for traffic to stabilize
    log "Waiting ${TRAFFIC_SWITCH_TIMEOUT} seconds for traffic to stabilize..."
    sleep $TRAFFIC_SWITCH_TIMEOUT

    # Verify the switch
    local active_env=$(get_active_env)
    if [ "$active_env" != "$new_env" ]; then
        error "Traffic switch verification failed. Expected ${new_env}, got ${active_env}"
        exit 1
    fi
}

# Clean up old environment
cleanup_old_env() {
    local old_env=$1

    log "Cleaning up old ${old_env} environment"

    # Here you would stop the old service
    # For example: docker-compose stop ${old_env}-service

    log "Cleanup completed"
}

# Rollback function
rollback() {
    local failed_env=$1
    local rollback_env

    case $failed_env in
        blue)
            rollback_env="green"
            ;;
        green)
            rollback_env="blue"
            ;;
        *)
            error "Cannot rollback: unknown failed environment"
            exit 1
            ;;
    esac

    warn "Rolling back to ${rollback_env} environment"
    switch_traffic $rollback_env
}

# Main deployment function
main() {
    log "Starting blue-green deployment"

    # Check prerequisites
    check_caddy_api

    local active_env=$(get_active_env)
    log "Current active environment: ${active_env}"

    # Deploy to inactive environment
    local new_env
    if ! new_env=$(deploy_to_inactive); then
        error "Deployment failed"
        exit 1
    fi

    # Switch traffic
    if switch_traffic $new_env; then
        log "Deployment successful! Traffic switched to ${new_env}"

        # Clean up old environment
        if [ "$active_env" != "unknown" ]; then
            cleanup_old_env $active_env
        fi

        log "Blue-green deployment completed successfully"
    else
        error "Traffic switch failed, rolling back..."
        rollback $new_env
        exit 1
    fi
}

# Run main function
main "$@"
