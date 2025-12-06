#!/bin/bash

# ValueCanvas Production Deployment Script
# This script automates the production deployment process based on the Production Polishing Guide

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
ENV_PRODUCTION=".env.production"
ENV_EXAMPLE=".env.example"
HEALTH_CHECK_URL="http://localhost/health"
MAX_HEALTH_CHECKS=30
HEALTH_CHECK_INTERVAL=10

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed or not in PATH"
        exit 1
    fi

    log_success "All dependencies are available"
}

setup_environment() {
    log_info "Setting up production environment..."

    # Check if production env file exists
    if [ ! -f "$ENV_PRODUCTION" ]; then
        if [ -f "$ENV_EXAMPLE" ]; then
            log_warning "Production environment file not found. Copying from example..."
            cp "$ENV_EXAMPLE" "$ENV_PRODUCTION"
            log_error "Please edit $ENV_PRODUCTION with your production credentials before continuing"
            log_info "Required variables:"
            log_info "  - VITE_SUPABASE_URL"
            log_info "  - VITE_SUPABASE_ANON_KEY"
            log_info "  - VITE_LLM_API_KEY"
            log_info "  - REDIS_PASSWORD"
            exit 1
        else
            log_error "Neither $ENV_PRODUCTION nor $ENV_EXAMPLE found"
            exit 1
        fi
    fi

    # Validate required environment variables
    if ! grep -q "VITE_SUPABASE_URL=" "$ENV_PRODUCTION" || grep -q "VITE_SUPABASE_URL=your-" "$ENV_PRODUCTION"; then
        log_error "VITE_SUPABASE_URL not configured in $ENV_PRODUCTION"
        exit 1
    fi

    if ! grep -q "VITE_SUPABASE_ANON_KEY=" "$ENV_PRODUCTION" || grep -q "VITE_SUPABASE_ANON_KEY=your-" "$ENV_PRODUCTION"; then
        log_error "VITE_SUPABASE_ANON_KEY not configured in $ENV_PRODUCTION"
        exit 1
    fi

    if ! grep -q "VITE_LLM_API_KEY=" "$ENV_PRODUCTION" || grep -q "VITE_LLM_API_KEY=your-" "$ENV_PRODUCTION"; then
        log_error "VITE_LLM_API_KEY not configured in $ENV_PRODUCTION"
        exit 1
    fi

    if ! grep -q "REDIS_PASSWORD=" "$ENV_PRODUCTION" || grep -q "REDIS_PASSWORD=\${" "$ENV_PRODUCTION"; then
        log_error "REDIS_PASSWORD not configured in $ENV_PRODUCTION"
        exit 1
    fi

    log_success "Environment configuration validated"
}

build_and_deploy() {
    log_info "Building and deploying production services..."

    # Build the services
    log_info "Building Docker images..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" build

    # Start services
    log_info "Starting production services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d

    log_success "Services deployed successfully"
}

verify_deployment() {
    log_info "Verifying deployment..."

    # Check container status
    log_info "Checking container status..."
    if ! docker-compose -f "$DOCKER_COMPOSE_FILE" ps | grep -q "Up"; then
        log_error "Some containers are not running"
        docker-compose -f "$DOCKER_COMPOSE_FILE" ps
        exit 1
    fi

    log_success "All containers are running"

    # Health check
    log_info "Performing health checks..."
    for i in $(seq 1 $MAX_HEALTH_CHECKS); do
        log_info "Health check attempt $i/$MAX_HEALTH_CHECKS..."
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            log_success "Health check passed!"
            break
        fi

        if [ $i -eq $MAX_HEALTH_CHECKS ]; then
            log_error "Health check failed after $MAX_HEALTH_CHECKS attempts"
            log_info "Check application logs:"
            docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f app
            exit 1
        fi

        sleep $HEALTH_CHECK_INTERVAL
    done
}

show_logs() {
    log_info "Showing recent logs..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs --tail=50
}

cleanup() {
    log_info "Cleaning up Docker system..."
    docker system prune -f
    log_success "Cleanup completed"
}

rollback() {
    log_warning "Initiating rollback..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    log_info "Previous deployment stopped. Manual intervention required for rollback."
}

# Main execution
main() {
    echo "🚀 ValueCanvas Production Deployment Script"
    echo "=========================================="
    echo ""

    # Parse command line arguments
    case "${1:-deploy}" in
        "deploy")
            check_dependencies
            setup_environment
            build_and_deploy
            verify_deployment
            show_logs
            cleanup
            log_success "🎉 Production deployment completed successfully!"
            log_info "Access your application at: http://localhost"
            ;;
        "rollback")
            rollback
            ;;
        "logs")
            show_logs
            ;;
        "status")
            docker-compose -f "$DOCKER_COMPOSE_FILE" ps
            ;;
        "stop")
            log_info "Stopping production services..."
            docker-compose -f "$DOCKER_COMPOSE_FILE" down
            log_success "Services stopped"
            ;;
        "restart")
            log_info "Restarting production services..."
            docker-compose -f "$DOCKER_COMPOSE_FILE" restart
            verify_deployment
            log_success "Services restarted"
            ;;
        *)
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  deploy    - Full deployment (default)"
            echo "  rollback  - Rollback to previous state"
            echo "  logs      - Show application logs"
            echo "  status    - Show container status"
            echo "  stop      - Stop all services"
            echo "  restart   - Restart all services"
            echo ""
            exit 1
            ;;
    esac
}

# Trap for cleanup on error
trap 'log_error "Deployment failed! Check logs above for details."' ERR

# Run main function with all arguments
main "$@"
