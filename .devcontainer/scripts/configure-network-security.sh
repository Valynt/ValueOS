#!/bin/bash
###############################################################################
# Configure Network Security
# 
# Sets up network segmentation and firewall rules
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
# Create Networks
###############################################################################

create_networks() {
    log_section "Creating Segmented Networks"
    
    # Frontend network (public)
    if ! docker network inspect frontend-network &> /dev/null; then
        docker network create \
            --driver bridge \
            --subnet 172.22.0.0/24 \
            --gateway 172.22.0.1 \
            --label com.valuecanvas.network.tier=frontend \
            --label com.valuecanvas.network.security=public \
            frontend-network
        log_info "✓ Created frontend-network"
    else
        log_info "Frontend network already exists"
    fi
    
    # Backend network (internal)
    if ! docker network inspect backend-network &> /dev/null; then
        docker network create \
            --driver bridge \
            --internal \
            --subnet 172.23.0.0/24 \
            --gateway 172.23.0.1 \
            --label com.valuecanvas.network.tier=backend \
            --label com.valuecanvas.network.security=internal \
            backend-network
        log_info "✓ Created backend-network (internal)"
    else
        log_info "Backend network already exists"
    fi
    
    # Database network (restricted)
    if ! docker network inspect database-network &> /dev/null; then
        docker network create \
            --driver bridge \
            --internal \
            --subnet 172.24.0.0/24 \
            --gateway 172.24.0.1 \
            --opt com.docker.network.bridge.enable_icc=false \
            --label com.valuecanvas.network.tier=database \
            --label com.valuecanvas.network.security=restricted \
            database-network
        log_info "✓ Created database-network (restricted)"
    else
        log_info "Database network already exists"
    fi
    
    # Management network (admin)
    if ! docker network inspect management-network &> /dev/null; then
        docker network create \
            --driver bridge \
            --subnet 172.25.0.0/24 \
            --gateway 172.25.0.1 \
            --label com.valuecanvas.network.tier=management \
            --label com.valuecanvas.network.security=admin \
            management-network
        log_info "✓ Created management-network"
    else
        log_info "Management network already exists"
    fi
}

###############################################################################
# Configure Firewall Rules (iptables)
###############################################################################

configure_firewall() {
    log_section "Configuring Firewall Rules"
    
    # Check if iptables is available
    if ! command -v iptables &> /dev/null; then
        log_warn "iptables not available, skipping firewall configuration"
        return 0
    fi
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        log_warn "Not running as root, skipping firewall configuration"
        log_info "Run with sudo to configure firewall rules"
        return 0
    fi
    
    log_info "Configuring iptables rules..."
    
    # Allow established connections
    iptables -A DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
    
    # Allow frontend to backend
    iptables -A DOCKER-USER -s 172.22.0.0/24 -d 172.23.0.0/24 -j ACCEPT
    
    # Allow backend to database
    iptables -A DOCKER-USER -s 172.23.0.0/24 -d 172.24.0.0/24 -j ACCEPT
    
    # Block direct frontend to database
    iptables -A DOCKER-USER -s 172.22.0.0/24 -d 172.24.0.0/24 -j DROP
    
    # Allow management to all
    iptables -A DOCKER-USER -s 172.25.0.0/24 -j ACCEPT
    
    log_info "✓ Firewall rules configured"
}

###############################################################################
# Show Network Status
###############################################################################

show_network_status() {
    log_section "Network Status"
    
    echo "Created Networks:"
    docker network ls --filter label=com.valuecanvas.network.tier --format "table {{.Name}}\t{{.Driver}}\t{{.Scope}}\t{{.Labels}}"
    
    echo ""
    echo "Network Details:"
    for network in frontend-network backend-network database-network management-network; do
        if docker network inspect "$network" &> /dev/null; then
            echo ""
            echo "Network: $network"
            docker network inspect "$network" --format '  Subnet: {{range .IPAM.Config}}{{.Subnet}}{{end}}'
            docker network inspect "$network" --format '  Internal: {{.Internal}}'
            docker network inspect "$network" --format '  Containers: {{len .Containers}}'
        fi
    done
}

###############################################################################
# Test Network Segmentation
###############################################################################

test_segmentation() {
    log_section "Testing Network Segmentation"
    
    log_info "Creating test containers..."
    
    # Create test containers on different networks
    docker run -d --name test-frontend --network frontend-network alpine sleep 3600 2>/dev/null || true
    docker run -d --name test-backend --network backend-network alpine sleep 3600 2>/dev/null || true
    docker run -d --name test-database --network database-network alpine sleep 3600 2>/dev/null || true
    
    sleep 2
    
    # Test connectivity
    log_info "Testing connectivity..."
    
    # Frontend should NOT reach database directly
    if docker exec test-frontend ping -c 1 -W 1 test-database &> /dev/null; then
        log_error "❌ Frontend can reach database (should be blocked)"
    else
        log_info "✓ Frontend cannot reach database (correct)"
    fi
    
    # Cleanup
    docker rm -f test-frontend test-backend test-database &> /dev/null || true
    
    log_info "✓ Segmentation test complete"
}

###############################################################################
# Generate Documentation
###############################################################################

generate_documentation() {
    log_section "Generating Documentation"
    
    cat > /workspaces/ValueOS/.devcontainer/NETWORK_SECURITY.md <<'EOF'
# Network Security Configuration

## Network Segmentation

### Network Tiers

1. **Frontend Network** (172.22.0.0/24)
   - Public facing
   - Exposed ports: 3000
   - Can communicate with: Backend
   - Cannot communicate with: Database directly

2. **Backend Network** (172.23.0.0/24)
   - Internal only
   - No exposed ports
   - Can communicate with: Frontend, Database, Redis
   - Cannot communicate with: External networks

3. **Database Network** (172.24.0.0/24)
   - Highly restricted
   - No exposed ports
   - Inter-container communication disabled
   - Can communicate with: Backend only
   - Cannot communicate with: Frontend, External networks

4. **Management Network** (172.25.0.0/24)
   - Admin access only
   - Monitoring and management tools
   - Can communicate with: All networks
   - Exposed ports: Localhost only (127.0.0.1)

## Firewall Rules

### Allowed Traffic
- Frontend → Backend (API calls)
- Backend → Database (queries)
- Backend → Redis (caching)
- Management → All (monitoring)

### Blocked Traffic
- Frontend → Database (direct access)
- External → Backend (no direct access)
- External → Database (no direct access)

## Port Exposure

### External Ports (0.0.0.0)
- 3000: Frontend (Vite dev server)

### Localhost Only (127.0.0.1)
- 9090: Prometheus (monitoring)
- 16686: Jaeger (tracing)

### No External Access
- 5432: PostgreSQL (database network only)
- 6379: Redis (backend network only)
- 8000: Backend API (backend network only)

## Usage

### Start with Network Security
```bash
# Configure networks
bash .devcontainer/scripts/configure-network-security.sh

# Start services with segmentation
docker-compose -f .devcontainer/network-security.yml up -d
```

### Verify Segmentation
```bash
# Check network configuration
docker network ls --filter label=com.valuecanvas.network.tier

# Test connectivity
bash .devcontainer/scripts/configure-network-security.sh test
```

### Connect Container to Network
```bash
# Connect to frontend network
docker network connect frontend-network my-container

# Connect to multiple networks
docker network connect backend-network my-container
docker network connect database-network my-container
```

## Security Best Practices

1. **Principle of Least Privilege**
   - Only connect containers to networks they need
   - Minimize exposed ports
   - Use internal networks when possible

2. **Network Isolation**
   - Keep database on isolated network
   - Use internal networks for backend services
   - Expose only frontend to external access

3. **Monitoring**
   - Monitor network traffic
   - Log connection attempts
   - Alert on unusual patterns

4. **Regular Audits**
   - Review network configuration monthly
   - Check for unnecessary connections
   - Update firewall rules as needed

## Troubleshooting

### Container Cannot Connect
```bash
# Check network membership
docker inspect <container> --format '{{json .NetworkSettings.Networks}}'

# Check network configuration
docker network inspect <network>

# Test connectivity
docker exec <container> ping <target>
```

### Port Not Accessible
```bash
# Check port bindings
docker port <container>

# Check firewall rules
sudo iptables -L DOCKER-USER -n

# Check network mode
docker inspect <container> --format '{{.HostConfig.NetworkMode}}'
```

## References

- [Docker Network Security](https://docs.docker.com/network/network-tutorial-standalone/)
- [Docker Network Drivers](https://docs.docker.com/network/drivers/)
- [iptables Documentation](https://www.netfilter.org/documentation/)
EOF
    
    log_info "✓ Documentation generated: .devcontainer/NETWORK_SECURITY.md"
}

###############################################################################
# Show Usage
###############################################################################

show_usage() {
    cat <<EOF
Usage: $0 COMMAND

Commands:
  setup     Create networks and configure firewall
  status    Show network status
  test      Test network segmentation
  docs      Generate documentation
  cleanup   Remove all networks

Examples:
  # Setup network security
  $0 setup

  # Check status
  $0 status

  # Test segmentation
  $0 test

EOF
}

###############################################################################
# Cleanup
###############################################################################

cleanup_networks() {
    log_section "Cleaning Up Networks"
    
    for network in frontend-network backend-network database-network management-network; do
        if docker network inspect "$network" &> /dev/null; then
            docker network rm "$network" 2>/dev/null || log_warn "Could not remove $network (may have connected containers)"
        fi
    done
    
    log_info "✓ Cleanup complete"
}

###############################################################################
# Main Execution
###############################################################################

main() {
    local command=${1:-setup}
    
    case "$command" in
        setup)
            create_networks
            configure_firewall
            generate_documentation
            show_network_status
            ;;
        status)
            show_network_status
            ;;
        test)
            test_segmentation
            ;;
        docs)
            generate_documentation
            ;;
        cleanup)
            cleanup_networks
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
