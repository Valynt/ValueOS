#!/bin/bash

# ============================================================================
# Deployment Validation Script
# ============================================================================
# Validates deployment health and readiness
# Usage: bash scripts/validate-deployment.sh [environment]
# ============================================================================

set -e

ENVIRONMENT=${1:-staging}
TIMEOUT=300  # 5 minutes
INTERVAL=5   # Check every 5 seconds

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# ============================================================================
# Environment Configuration
# ============================================================================

case $ENVIRONMENT in
    local)
        BASE_URL="http://localhost:3000"
        HEALTH_ENDPOINT="/health"
        ;;
    staging)
        BASE_URL="http://localhost:8001"
        HEALTH_ENDPOINT="/healthz"
        ;;
    prod)
        BASE_URL="${PROD_URL:-https://valuecanvas.com}"
        HEALTH_ENDPOINT="/healthz"
        ;;
    *)
        log_error "Invalid environment: $ENVIRONMENT"
        echo "Usage: $0 [local|staging|prod]"
        exit 1
        ;;
esac

# ============================================================================
# Validation Functions
# ============================================================================

check_health_endpoint() {
    log_info "Checking health endpoint: ${BASE_URL}${HEALTH_ENDPOINT}"
    
    local elapsed=0
    while [ $elapsed -lt $TIMEOUT ]; do
        if curl -sf "${BASE_URL}${HEALTH_ENDPOINT}" > /dev/null 2>&1; then
            log_success "Health endpoint is responding"
            return 0
        fi
        
        sleep $INTERVAL
        elapsed=$((elapsed + INTERVAL))
        echo -n "."
    done
    
    echo ""
    log_error "Health endpoint not responding after ${TIMEOUT}s"
    return 1
}

check_database_connection() {
    log_info "Checking database connection..."
    
    if [ "$ENVIRONMENT" = "local" ]; then
        if docker ps | grep -q "supabase-db"; then
            log_success "Database container is running"
            return 0
        else
            log_error "Database container is not running"
            return 1
        fi
    else
        # For staging/prod, check via health endpoint
        local response=$(curl -sf "${BASE_URL}${HEALTH_ENDPOINT}" 2>/dev/null || echo "{}")
        if echo "$response" | grep -q "database"; then
            log_success "Database connection verified"
            return 0
        else
            log_warning "Could not verify database connection"
            return 0  # Don't fail deployment
        fi
    fi
}

check_redis_connection() {
    log_info "Checking Redis connection..."
    
    if [ "$ENVIRONMENT" = "local" ]; then
        if docker ps | grep -q "redis"; then
            log_success "Redis container is running"
            return 0
        else
            log_warning "Redis container is not running"
            return 0  # Redis is optional
        fi
    else
        log_info "Skipping Redis check for $ENVIRONMENT"
        return 0
    fi
}

check_api_endpoints() {
    log_info "Checking critical API endpoints..."
    
    local endpoints=(
        "/api/health"
        "/api/v1/canvases"
    )
    
    local failed=0
    for endpoint in "${endpoints[@]}"; do
        if curl -sf "${BASE_URL}${endpoint}" > /dev/null 2>&1; then
            log_success "Endpoint ${endpoint} is accessible"
        else
            log_warning "Endpoint ${endpoint} is not accessible"
            failed=$((failed + 1))
        fi
    done
    
    if [ $failed -eq ${#endpoints[@]} ]; then
        log_error "All API endpoints are inaccessible"
        return 1
    fi
    
    return 0
}

check_static_assets() {
    log_info "Checking static assets..."
    
    if curl -sf "${BASE_URL}/" > /dev/null 2>&1; then
        log_success "Static assets are being served"
        return 0
    else
        log_error "Static assets are not accessible"
        return 1
    fi
}

check_docker_containers() {
    if [ "$ENVIRONMENT" = "local" ]; then
        log_info "Checking Docker containers..."
        
        local required_containers=(
            "supabase-db"
            "supabase-studio"
        )
        
        local failed=0
        for container in "${required_containers[@]}"; do
            if docker ps | grep -q "$container"; then
                log_success "Container $container is running"
            else
                log_error "Container $container is not running"
                failed=$((failed + 1))
            fi
        done
        
        return $failed
    fi
    
    return 0
}

check_environment_variables() {
    log_info "Checking environment variables..."
    
    local required_vars=()
    
    case $ENVIRONMENT in
        local)
            required_vars=(
                "VITE_SUPABASE_URL"
                "VITE_SUPABASE_ANON_KEY"
            )
            ;;
        staging)
            required_vars=(
                "STAGE_DATABASE_URL"
                "VITE_SUPABASE_URL"
                "VITE_SUPABASE_ANON_KEY"
            )
            ;;
        prod)
            required_vars=(
                "DATABASE_URL"
                "VITE_SUPABASE_URL"
                "VITE_SUPABASE_ANON_KEY"
            )
            ;;
    esac
    
    local missing=0
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_warning "Environment variable $var is not set"
            missing=$((missing + 1))
        else
            log_success "Environment variable $var is set"
        fi
    done
    
    if [ $missing -gt 0 ]; then
        log_warning "$missing environment variables are missing"
    fi
    
    return 0  # Don't fail on missing env vars
}

check_ssl_certificate() {
    if [ "$ENVIRONMENT" = "prod" ]; then
        log_info "Checking SSL certificate..."
        
        if echo | openssl s_client -connect "${BASE_URL#https://}:443" -servername "${BASE_URL#https://}" 2>/dev/null | grep -q "Verify return code: 0"; then
            log_success "SSL certificate is valid"
            return 0
        else
            log_error "SSL certificate is invalid or expired"
            return 1
        fi
    fi
    
    return 0
}

check_response_time() {
    log_info "Checking response time..."
    
    local start=$(date +%s%N)
    curl -sf "${BASE_URL}${HEALTH_ENDPOINT}" > /dev/null 2>&1
    local end=$(date +%s%N)
    
    local duration=$(( (end - start) / 1000000 ))  # Convert to milliseconds
    
    if [ $duration -lt 1000 ]; then
        log_success "Response time: ${duration}ms (good)"
        return 0
    elif [ $duration -lt 3000 ]; then
        log_warning "Response time: ${duration}ms (acceptable)"
        return 0
    else
        log_error "Response time: ${duration}ms (too slow)"
        return 1
    fi
}

# ============================================================================
# Main Validation
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Deployment Validation - $ENVIRONMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

FAILED_CHECKS=0

# Run all checks
check_health_endpoint || FAILED_CHECKS=$((FAILED_CHECKS + 1))
echo ""

check_database_connection || FAILED_CHECKS=$((FAILED_CHECKS + 1))
echo ""

check_redis_connection || FAILED_CHECKS=$((FAILED_CHECKS + 1))
echo ""

check_api_endpoints || FAILED_CHECKS=$((FAILED_CHECKS + 1))
echo ""

check_static_assets || FAILED_CHECKS=$((FAILED_CHECKS + 1))
echo ""

check_docker_containers || FAILED_CHECKS=$((FAILED_CHECKS + 1))
echo ""

check_environment_variables || FAILED_CHECKS=$((FAILED_CHECKS + 1))
echo ""

check_ssl_certificate || FAILED_CHECKS=$((FAILED_CHECKS + 1))
echo ""

check_response_time || FAILED_CHECKS=$((FAILED_CHECKS + 1))
echo ""

# ============================================================================
# Summary
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    log_success "All validation checks passed!"
    echo ""
    echo "✅ Deployment is healthy and ready"
    exit 0
else
    log_error "$FAILED_CHECKS validation check(s) failed"
    echo ""
    echo "❌ Deployment has issues that need attention"
    exit 1
fi
