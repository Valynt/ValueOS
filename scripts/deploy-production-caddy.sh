#!/bin/bash
###############################################################################
# Production Deployment Script for ValueCanvas with Caddy
# Deploys the application with automatic HTTPS and production hardening
###############################################################################

set -e

echo "🚀 ValueCanvas Production Deployment with Caddy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Do not run this script as root"
    exit 1
fi

# 1. Check prerequisites
print_status "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed"
    exit 1
fi

print_success "Prerequisites met"

# 2. Load environment variables
print_status "Loading environment variables..."

if [ -f ".env.production" ]; then
    source .env.production
    print_success "Loaded .env.production"
elif [ -f ".env" ]; then
    source .env
    print_success "Loaded .env"
else
    print_error "No environment file found (.env.production or .env)"
    exit 1
fi

# 3. Validate required environment variables
print_status "Validating environment variables..."

REQUIRED_VARS=(
    "VITE_SUPABASE_URL"
    "VITE_SUPABASE_ANON_KEY"
    "REDIS_PASSWORD"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    print_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    exit 1
fi

print_success "Environment variables validated"

# 4. Check domain configuration
print_status "Checking domain configuration..."

DOMAIN=${DOMAIN:-app.valuecanvas.com}
API_DOMAIN=${API_DOMAIN:-api.valuecanvas.com}

print_success "Domain: $DOMAIN"
print_success "API Domain: $API_DOMAIN"

# 5. Backup existing data (if any)
print_status "Checking for existing deployment..."

if docker ps -a | grep -q "valuecanvas-caddy-prod"; then
    print_warning "Existing deployment found"
    read -p "Do you want to backup volumes before deploying? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        
        print_status "Creating backup..."
        docker run --rm -v valuecanvas_caddy-data:/data -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf /backup/caddy-data.tar.gz -C /data .
        docker run --rm -v valuecanvas_caddy-config:/data -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf /backup/caddy-config.tar.gz -C /data .
        
        print_success "Backup created in $BACKUP_DIR"
    fi
fi

# 6. Pull latest images
print_status "Pulling latest images..."
docker-compose -f docker-compose.prod.yml pull

# 7. Build custom images
print_status "Building custom images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# 8. Stop existing containers
print_status "Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# 9. Start services
print_status "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# 10. Wait for services to be healthy
print_status "Waiting for services to start..."
echo "This may take a minute..."

TIMEOUT=300
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    HEALTHY=$(docker-compose -f docker-compose.prod.yml ps | grep -c "healthy" || true)
    TOTAL=$(docker-compose -f docker-compose.prod.yml ps | grep -c "Up" || true)
    
    if [ "$HEALTHY" -eq "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
        break
    fi
    
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    echo -n "."
done
echo ""

# 11. Check service status
print_status "Checking service status..."
docker-compose -f docker-compose.prod.yml ps

# 12. Test connectivity
echo ""
print_status "Testing connectivity..."

# Test health endpoint
if curl -f -s http://localhost/health > /dev/null 2>&1; then
    print_success "Health endpoint responding"
else
    print_warning "Health endpoint not responding yet (may need DNS propagation)"
fi

# 13. Display SSL/TLS certificate status
print_status "Checking SSL/TLS certificates..."

sleep 5  # Give Caddy time to request certificates

if docker exec valuecanvas-caddy-prod caddy list-certificates 2>/dev/null | grep -q "$DOMAIN"; then
    print_success "SSL certificate obtained for $DOMAIN"
else
    print_warning "SSL certificate pending for $DOMAIN (may take a few minutes)"
    echo "Caddy will automatically request and install certificates when the domain is accessible"
fi

# 14. Display logs
print_status "Recent logs..."
docker-compose -f docker-compose.prod.yml logs --tail=20

# 15. Display summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Production Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Access your application:"
echo "  • Application: https://$DOMAIN"
echo "  • API:         https://$API_DOMAIN"
echo "  • Health:      http://localhost/health"
echo ""
echo "Services running:"
docker-compose -f docker-compose.prod.yml ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "SSL/TLS:"
echo "  • Caddy will automatically obtain and renew Let's Encrypt certificates"
echo "  • Ensure DNS records point to this server:"
echo "    - $DOMAIN → $(curl -s ifconfig.me)"
echo "    - $API_DOMAIN → $(curl -s ifconfig.me)"
echo ""
echo "Useful commands:"
echo "  • View logs:         docker-compose -f docker-compose.prod.yml logs -f"
echo "  • Restart service:   docker-compose -f docker-compose.prod.yml restart <service>"
echo "  • Stop all:          docker-compose -f docker-compose.prod.yml down"
echo "  • Check certs:       docker exec valuecanvas-caddy-prod caddy list-certificates"
echo "  • Reload Caddyfile:  docker exec valuecanvas-caddy-prod caddy reload --config /etc/caddy/Caddyfile"
echo ""
echo "Monitoring:"
echo "  • Container status:  docker-compose -f docker-compose.prod.yml ps"
echo "  • Resource usage:    docker stats"
echo "  • Disk usage:        docker system df"
echo ""
echo "Security:"
echo "  • All services run as non-root users"
echo "  • TLS 1.2+ only with strong ciphers"
echo "  • Security headers enabled (HSTS, CSP, etc.)"
echo "  • Rate limiting active (60 req/min per IP)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
