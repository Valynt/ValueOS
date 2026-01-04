#!/bin/bash
###############################################################################
# Start Services with Retry Logic
# 
# Provides resilient service startup with:
# - Exponential backoff
# - Health checks
# - Automatic recovery
# - Failure notifications
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
MAX_RETRIES=${MAX_RETRIES:-3}
INITIAL_DELAY=${INITIAL_DELAY:-5}
MAX_DELAY=${MAX_DELAY:-60}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-30}

###############################################################################
# Helper Functions
###############################################################################

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
# Retry Logic with Exponential Backoff
###############################################################################

retry_with_backoff() {
    local service_name=$1
    local command=$2
    local health_check=$3
    
    local retries=0
    local delay=$INITIAL_DELAY
    
    while [ $retries -lt $MAX_RETRIES ]; do
        log_info "Starting $service_name (attempt $((retries + 1))/$MAX_RETRIES)..."
        
        # Execute command
        if eval "$command" 2>&1 | tee "/tmp/${service_name}_start.log"; then
            log_info "✓ $service_name command executed"
            
            # Wait for service to be healthy
            if wait_for_health "$service_name" "$health_check"; then
                log_info "✅ $service_name started successfully"
                return 0
            else
                log_warn "$service_name started but health check failed"
            fi
        else
            log_error "$service_name start command failed"
        fi
        
        retries=$((retries + 1))
        
        if [ $retries -lt $MAX_RETRIES ]; then
            log_warn "⏳ Retrying in ${delay}s..."
            sleep $delay
            
            # Exponential backoff (double delay, cap at MAX_DELAY)
            delay=$((delay * 2))
            if [ $delay -gt $MAX_DELAY ]; then
                delay=$MAX_DELAY
            fi
        fi
    done
    
    log_error "❌ $service_name failed after $MAX_RETRIES attempts"
    return 1
}

###############################################################################
# Health Check with Timeout
###############################################################################

wait_for_health() {
    local service_name=$1
    local health_check=$2
    
    if [ -z "$health_check" ]; then
        log_info "No health check defined for $service_name, assuming healthy"
        return 0
    fi
    
    log_info "Waiting for $service_name to be healthy..."
    
    local elapsed=0
    local check_interval=2
    
    while [ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]; do
        if eval "$health_check" &> /dev/null; then
            log_info "✓ $service_name is healthy"
            return 0
        fi
        
        sleep $check_interval
        elapsed=$((elapsed + check_interval))
        
        # Show progress
        if [ $((elapsed % 10)) -eq 0 ]; then
            log_info "Still waiting... (${elapsed}s/${HEALTH_CHECK_TIMEOUT}s)"
        fi
    done
    
    log_error "$service_name health check timeout after ${HEALTH_CHECK_TIMEOUT}s"
    return 1
}

###############################################################################
# Service Definitions
###############################################################################

start_postgres() {
    log_section "PostgreSQL"
    
    retry_with_backoff \
        "PostgreSQL" \
        "docker-compose up -d postgres" \
        "pg_isready -h localhost -p 5432"
}

start_redis() {
    log_section "Redis"
    
    retry_with_backoff \
        "Redis" \
        "docker-compose up -d redis" \
        "redis-cli -h localhost -p 6379 ping | grep -q PONG"
}

start_backend() {
    log_section "Backend API"
    
    retry_with_backoff \
        "Backend" \
        "npm run dev:backend" \
        "curl -sf http://localhost:8000/health"
}

start_frontend() {
    log_section "Frontend"
    
    retry_with_backoff \
        "Frontend" \
        "npm run dev" \
        "curl -sf http://localhost:3000"
}

start_supabase() {
    log_section "Supabase"
    
    retry_with_backoff \
        "Supabase" \
        "supabase start" \
        "curl -sf http://localhost:54323"
}

###############################################################################
# Start All Services
###############################################################################

start_all() {
    log_section "Starting All Services"
    
    local failed_services=()
    
    # Start services in dependency order
    start_postgres || failed_services+=("PostgreSQL")
    start_redis || failed_services+=("Redis")
    start_supabase || failed_services+=("Supabase")
    start_backend || failed_services+=("Backend")
    start_frontend || failed_services+=("Frontend")
    
    # Summary
    echo ""
    log_section "Startup Summary"
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        log_info "✅ All services started successfully"
        return 0
    else
        log_error "❌ Failed services: ${failed_services[*]}"
        log_info "Check logs in /tmp/*_start.log"
        return 1
    fi
}

###############################################################################
# Start Specific Service
###############################################################################

start_service() {
    local service=$1
    
    case "$service" in
        postgres|postgresql)
            start_postgres
            ;;
        redis)
            start_redis
            ;;
        backend|api)
            start_backend
            ;;
        frontend|web)
            start_frontend
            ;;
        supabase)
            start_supabase
            ;;
        *)
            log_error "Unknown service: $service"
            log_info "Available services: postgres, redis, backend, frontend, supabase"
            exit 1
            ;;
    esac
}

###############################################################################
# Show Usage
###############################################################################

show_usage() {
    cat <<EOF
Usage: $0 [OPTIONS] [SERVICE]

Start services with automatic retry and health checks.

Services:
  all               Start all services (default)
  postgres          PostgreSQL database
  redis             Redis cache
  backend           Backend API
  frontend          Frontend application
  supabase          Supabase local development

Options:
  --max-retries N   Maximum retry attempts (default: 3)
  --initial-delay N Initial delay in seconds (default: 5)
  --max-delay N     Maximum delay in seconds (default: 60)
  --health-timeout N Health check timeout (default: 30)
  --help            Show this help message

Environment Variables:
  MAX_RETRIES       Same as --max-retries
  INITIAL_DELAY     Same as --initial-delay
  MAX_DELAY         Same as --max-delay
  HEALTH_CHECK_TIMEOUT Same as --health-timeout

Examples:
  # Start all services
  $0

  # Start specific service
  $0 postgres

  # Start with custom retry settings
  $0 --max-retries 5 --initial-delay 10 backend

  # Start with environment variables
  MAX_RETRIES=5 $0 all

EOF
}

###############################################################################
# Main Execution
###############################################################################

main() {
    local service="all"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --max-retries)
                MAX_RETRIES="$2"
                shift 2
                ;;
            --initial-delay)
                INITIAL_DELAY="$2"
                shift 2
                ;;
            --max-delay)
                MAX_DELAY="$2"
                shift 2
                ;;
            --health-timeout)
                HEALTH_CHECK_TIMEOUT="$2"
                shift 2
                ;;
            --help)
                show_usage
                exit 0
                ;;
            all|postgres|postgresql|redis|backend|api|frontend|web|supabase)
                service="$1"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    echo "========================================="
    echo "  Service Startup with Retry"
    echo "========================================="
    echo ""
    log_info "Configuration:"
    log_info "  Max retries: $MAX_RETRIES"
    log_info "  Initial delay: ${INITIAL_DELAY}s"
    log_info "  Max delay: ${MAX_DELAY}s"
    log_info "  Health check timeout: ${HEALTH_CHECK_TIMEOUT}s"
    echo ""
    
    # Start service(s)
    if [ "$service" = "all" ]; then
        start_all
    else
        start_service "$service"
    fi
}

# Run main function
main "$@"
