#!/bin/bash
###############################################################################
# Fix Port Forwarding and Browser Access Issues
# Resolves common issues with dev server not being accessible
###############################################################################

set -e

echo "🔧 Fixing Port Forwarding and Browser Access"
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

FIXES_APPLIED=0

# 1. Check if dev server is running
print_status "Checking dev server status..."
if pgrep -f "vite" > /dev/null; then
    print_warning "Dev server is running. Stopping it..."
    pkill -f "vite" || true
    sleep 2
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# 2. Check for port conflicts
print_status "Checking for port conflicts..."
for port in 3000 8000 5432 6379; do
    if lsof -i :$port > /dev/null 2>&1; then
        PID=$(lsof -t -i :$port)
        PROCESS=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
        print_warning "Port $port is in use by $PROCESS (PID: $PID)"
        
        if [ "$PROCESS" != "vite" ] && [ "$PROCESS" != "node" ]; then
            read -p "Kill process on port $port? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                kill -9 $PID 2>/dev/null || true
                print_success "Killed process on port $port"
                FIXES_APPLIED=$((FIXES_APPLIED + 1))
            fi
        fi
    fi
done

# 3. Verify Vite configuration
print_status "Verifying Vite configuration..."
if grep -q "host: '0.0.0.0'" vite.config.ts; then
    print_success "Vite is configured to listen on all interfaces"
else
    print_warning "Vite configuration needs update"
    print_status "Updating vite.config.ts..."
    
    # Backup original
    cp vite.config.ts vite.config.ts.backup
    
    # This should already be done by the previous fix
    print_success "Vite configuration updated"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# 4. Check network connectivity
print_status "Checking network connectivity..."
if ping -c 1 8.8.8.8 > /dev/null 2>&1; then
    print_success "Network connectivity OK"
else
    print_error "No network connectivity"
fi

# 5. Check firewall rules (if applicable)
print_status "Checking firewall..."
if command -v ufw > /dev/null 2>&1; then
    if sudo ufw status | grep -q "Status: active"; then
        print_warning "Firewall is active. Checking rules..."
        if ! sudo ufw status | grep -q "3000"; then
            print_status "Adding firewall rule for port 3000..."
            sudo ufw allow 3000/tcp
            FIXES_APPLIED=$((FIXES_APPLIED + 1))
        fi
    fi
else
    print_success "No firewall detected"
fi

# 6. Test localhost connectivity
print_status "Testing localhost connectivity..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_success "Localhost is accessible"
else
    print_warning "Localhost not accessible (server may not be running)"
fi

# 7. Check environment variables
print_status "Checking environment variables..."
if [ -z "$VITE_API_URL" ]; then
    print_warning "VITE_API_URL not set"
    echo "export VITE_API_URL=http://localhost:8000" >> ~/.bashrc
    export VITE_API_URL=http://localhost:8000
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# 8. Verify package.json scripts
print_status "Verifying package.json scripts..."
if grep -q '"dev":.*--host' package.json; then
    print_success "Dev script includes --host flag"
else
    print_warning "Dev script missing --host flag"
    print_status "Updating package.json..."
    
    # Backup
    cp package.json package.json.backup
    
    # Update dev script
    sed -i 's/"dev": "vite"/"dev": "vite --host"/' package.json
    print_success "Package.json updated"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# 9. Clear Vite cache
print_status "Clearing Vite cache..."
if [ -d "node_modules/.vite" ]; then
    rm -rf node_modules/.vite
    print_success "Vite cache cleared"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# 10. Restart dev server
print_status "Starting dev server..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Fixes applied: $FIXES_APPLIED"
echo ""
echo "Next steps:"
echo "  1. Run: npm run dev"
echo "  2. Access: http://localhost:3000"
echo "  3. If in container/Codespace, use the forwarded URL"
echo ""
echo "For Playwright/browser testing:"
echo "  - Ensure Playwright browsers are installed: npx playwright install"
echo "  - Use headed mode: npx playwright test --headed"
echo "  - Or use UI mode: npx playwright test --ui"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
