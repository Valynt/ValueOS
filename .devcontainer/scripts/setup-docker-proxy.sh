#!/bin/bash
###############################################################################
# Setup Docker Socket Proxy
# 
# Configures restricted Docker API access through a proxy
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=========================================${NC}"
    echo ""
}

###############################################################################
# Check Prerequisites
###############################################################################

check_prerequisites() {
    log_section "Checking Prerequisites"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose not found"
        exit 1
    fi
    
    # Check if running as root or in docker group
    if [ "$EUID" -ne 0 ] && ! groups | grep -q docker; then
        log_error "Must be root or in docker group"
        exit 1
    fi
    
    log_info "✓ Prerequisites met"
}

###############################################################################
# Start Docker Proxy
###############################################################################

start_proxy() {
    log_section "Starting Docker Socket Proxy"
    
    cd /workspaces/ValueOS/.devcontainer
    
    # Start proxy service
    if docker compose version &> /dev/null; then
        docker compose -f docker-compose.security.yml up -d docker-proxy
    else
        docker-compose -f docker-compose.security.yml up -d docker-proxy
    fi
    
    log_info "✓ Docker proxy started"
}

###############################################################################
# Verify Proxy
###############################################################################

verify_proxy() {
    log_section "Verifying Docker Proxy"
    
    # Wait for proxy to be ready
    log_info "Waiting for proxy to be ready..."
    sleep 5
    
    # Check if proxy is running
    if ! docker ps | grep -q valuecanvas-docker-proxy; then
        log_error "Docker proxy not running"
        return 1
    fi
    
    log_info "✓ Docker proxy is running"
    
    # Test proxy access
    log_info "Testing proxy access..."
    
    # Get proxy IP
    local proxy_ip=$(docker inspect valuecanvas-docker-proxy --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
    
    if [ -z "$proxy_ip" ]; then
        log_error "Could not get proxy IP"
        return 1
    fi
    
    log_info "Proxy IP: $proxy_ip"
    
    # Test allowed operation (list containers)
    if curl -sf "http://${proxy_ip}:2375/containers/json" > /dev/null; then
        log_info "✓ Allowed operation works (list containers)"
    else
        log_warn "Could not test allowed operation"
    fi
    
    # Test denied operation (create container)
    if curl -sf -X POST "http://${proxy_ip}:2375/containers/create" > /dev/null 2>&1; then
        log_error "Denied operation succeeded (should fail)"
        return 1
    else
        log_info "✓ Denied operation blocked (create container)"
    fi
    
    log_info "✅ Docker proxy verified"
}

###############################################################################
# Configure Environment
###############################################################################

configure_environment() {
    log_section "Configuring Environment"
    
    # Get proxy IP
    local proxy_ip=$(docker inspect valuecanvas-docker-proxy --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
    
    # Create environment file
    cat > /workspaces/ValueOS/.devcontainer/.docker-proxy.env <<EOF
# Docker Socket Proxy Configuration
# Source this file to use the proxy: source .devcontainer/.docker-proxy.env

export DOCKER_HOST=tcp://${proxy_ip}:2375
export DOCKER_API_VERSION=1.41

# To revert to direct socket access:
# unset DOCKER_HOST
# unset DOCKER_API_VERSION
EOF
    
    log_info "✓ Environment configuration created"
    log_info "To use proxy: source .devcontainer/.docker-proxy.env"
}

###############################################################################
# Show Status
###############################################################################

show_status() {
    log_section "Docker Proxy Status"
    
    echo "Container Status:"
    docker ps --filter name=valuecanvas-docker-proxy --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo "Network Configuration:"
    docker inspect valuecanvas-docker-proxy --format '{{range .NetworkSettings.Networks}}Network: {{.NetworkID}} IP: {{.IPAddress}}{{end}}'
    
    echo ""
    echo "Resource Usage:"
    docker stats valuecanvas-docker-proxy --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
    
    echo ""
    echo "Logs (last 10 lines):"
    docker logs valuecanvas-docker-proxy --tail 10
}

###############################################################################
# Show Usage
###############################################################################

show_usage() {
    cat <<EOF
Usage: $0 COMMAND

Commands:
  start     Start Docker socket proxy
  stop      Stop Docker socket proxy
  restart   Restart Docker socket proxy
  status    Show proxy status
  verify    Verify proxy configuration
  logs      Show proxy logs

Examples:
  # Start proxy
  $0 start

  # Check status
  $0 status

  # View logs
  $0 logs

  # Use proxy in shell
  source .devcontainer/.docker-proxy.env
  docker ps  # Uses proxy

EOF
}

###############################################################################
# Main Execution
###############################################################################

main() {
    local command=${1:-start}
    
    case "$command" in
        start)
            check_prerequisites
            start_proxy
            verify_proxy
            configure_environment
            show_status
            ;;
        stop)
            log_info "Stopping Docker proxy..."
            cd /workspaces/ValueOS/.devcontainer
            if docker compose version &> /dev/null; then
                docker compose -f docker-compose.security.yml down docker-proxy
            else
                docker-compose -f docker-compose.security.yml down docker-proxy
            fi
            log_info "✓ Docker proxy stopped"
            ;;
        restart)
            $0 stop
            sleep 2
            $0 start
            ;;
        status)
            show_status
            ;;
        verify)
            verify_proxy
            ;;
        logs)
            docker logs valuecanvas-docker-proxy --follow
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
