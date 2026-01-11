#!/bin/bash
###############################################################################
# Network and Port Diagnostic Script
# Diagnoses network connectivity and port forwarding issues
###############################################################################

set -e

echo "🔍 Network and Port Diagnostics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ -f ".env.ports" ]; then
    while IFS='=' read -r key value; do
        if [[ -z "$key" || "$key" == \#* ]]; then
            continue
        fi
        if [ -z "${!key}" ]; then
            export "$key"="$value"
        fi
    done < ".env.ports"
fi

VITE_PORT="${VITE_PORT:-5173}"
API_PORT="${API_PORT:-3001}"

print_section() {
    echo ""
    echo -e "${BLUE}━━━ $1 ━━━${NC}"
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

# 1. System Information
print_section "System Information"
echo "OS: $(uname -s)"
echo "Kernel: $(uname -r)"
echo "Hostname: $(hostname)"
echo "User: $(whoami)"

# 2. Network Interfaces
print_section "Network Interfaces"
if command -v ip > /dev/null 2>&1; then
    ip addr show | grep -E "^[0-9]+:|inet " | head -20
else
    ifconfig | grep -E "^[a-z]|inet " | head -20
fi

# 3. Listening Ports
print_section "Listening Ports"
echo "Checking common development ports..."
for port in "$VITE_PORT" "$API_PORT" 5432 6379 9090 16686; do
    if lsof -i :$port > /dev/null 2>&1; then
        PID=$(lsof -t -i :$port)
        PROCESS=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
        print_success "Port $port: $PROCESS (PID: $PID)"
    else
        print_warning "Port $port: Not in use"
    fi
done

# 4. Running Processes
print_section "Development Processes"
echo "Node.js processes:"
ps aux | grep -E "node|npm|vite" | grep -v grep | head -10 || echo "None found"

# 5. Network Connectivity
print_section "Network Connectivity"

# Test localhost
if curl -s "http://localhost:${VITE_PORT}" > /dev/null 2>&1; then
    print_success "localhost:${VITE_PORT} is accessible (frontend)"
else
    print_warning "localhost:${VITE_PORT} is not accessible (frontend)"
fi

if curl -s "http://localhost:${API_PORT}/health" > /dev/null 2>&1; then
    print_success "localhost:${API_PORT} is accessible (backend)"
else
    print_warning "localhost:${API_PORT} is not accessible (backend)"
fi

# Test 0.0.0.0
if curl -s "http://0.0.0.0:${VITE_PORT}" > /dev/null 2>&1; then
    print_success "0.0.0.0:${VITE_PORT} is accessible (frontend)"
else
    print_warning "0.0.0.0:${VITE_PORT} is not accessible (frontend)"
fi

if curl -s "http://0.0.0.0:${API_PORT}/health" > /dev/null 2>&1; then
    print_success "0.0.0.0:${API_PORT} is accessible (backend)"
else
    print_warning "0.0.0.0:${API_PORT} is not accessible (backend)"
fi

# Test external connectivity
if ping -c 1 8.8.8.8 > /dev/null 2>&1; then
    print_success "External network connectivity OK"
else
    print_error "No external network connectivity"
fi

# 6. DNS Resolution
print_section "DNS Resolution"
if nslookup google.com > /dev/null 2>&1; then
    print_success "DNS resolution working"
else
    print_error "DNS resolution failed"
fi

# 7. Firewall Status
print_section "Firewall Status"
if command -v ufw > /dev/null 2>&1; then
    if sudo ufw status 2>/dev/null | grep -q "Status: active"; then
        print_warning "UFW firewall is active"
        sudo ufw status | grep -E "${VITE_PORT}|${API_PORT}|5432"
    else
        print_success "UFW firewall is inactive"
    fi
elif command -v firewall-cmd > /dev/null 2>&1; then
    if sudo firewall-cmd --state 2>/dev/null | grep -q "running"; then
        print_warning "firewalld is running"
        sudo firewall-cmd --list-ports
    else
        print_success "firewalld is not running"
    fi
else
    print_success "No firewall detected"
fi

# 8. Container/VM Detection
print_section "Environment Detection"
if [ -f "/.dockerenv" ]; then
    print_warning "Running in Docker container"
elif [ -f "/workspace/.gitpod.yml" ]; then
    print_warning "Running in Gitpod"
elif [ -n "$CODESPACES" ]; then
    print_warning "Running in GitHub Codespaces"
elif [ -n "$DEVCONTAINER" ]; then
    print_warning "Running in Dev Container"
else
    print_success "Running on host machine"
fi

# 9. Port Forwarding (if in container)
if [ -f "/.dockerenv" ] || [ -n "$CODESPACES" ] || [ -n "$DEVCONTAINER" ]; then
    print_section "Port Forwarding"
    
    if [ -n "$CODESPACES" ]; then
        echo "Codespace ports:"
        gh codespace ports 2>/dev/null || echo "gh CLI not available"
    fi
    
    if command -v gp > /dev/null 2>&1; then
        echo "Gitpod ports:"
        gp ports list 2>/dev/null || echo "Not in Gitpod"
    fi
fi

# 10. Vite Configuration
print_section "Vite Configuration"
if [ -f "vite.config.ts" ]; then
    if grep -q "host: '0.0.0.0'" vite.config.ts; then
        print_success "Vite configured to listen on all interfaces"
    else
        print_error "Vite NOT configured to listen on all interfaces"
        echo "Add to vite.config.ts:"
        echo "  server: { host: '0.0.0.0', port: ${VITE_PORT} }"
    fi
else
    print_warning "vite.config.ts not found"
fi

# 11. Environment Variables
print_section "Environment Variables"
echo "VITE_PORT: ${VITE_PORT}"
echo "API_PORT: ${API_PORT}"
echo "VITE_API_URL: ${VITE_API_URL:-not set}"
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "PORT: ${PORT:-not set}"
echo "HOST: ${HOST:-not set}"

# 12. Recommendations
print_section "Recommendations"
echo ""

if ! lsof -i :"$VITE_PORT" > /dev/null 2>&1; then
    echo "1. Start frontend: VITE_PORT=${VITE_PORT} npm run dev"
fi

if ! lsof -i :"$API_PORT" > /dev/null 2>&1; then
    echo "2. Start backend: API_PORT=${API_PORT} npm run backend:dev"
fi

if ! grep -q "host: '0.0.0.0'" vite.config.ts 2>/dev/null; then
    echo "3. Update vite.config.ts to listen on 0.0.0.0"
fi

if [ -f "/.dockerenv" ] || [ -n "$CODESPACES" ]; then
    echo "4. Ensure ports are forwarded in container configuration"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "For more help, see: docs/TROUBLESHOOTING_PORT_FORWARDING.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
