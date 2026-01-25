#!/bin/bash
###############################################################################
# Fix Port Forwarding and Browser Access Issues
# Resolves common issues with dev server not being accessible
#
# Usage:
#   bash scripts/dev-automation/fix-port-forwarding.sh          # Advisory mode (default)
#   bash scripts/dev-automation/fix-port-forwarding.sh --apply  # Apply fixes
###############################################################################

set -e

APPLY_MODE=false
if [[ "$1" == "--apply" ]]; then
    APPLY_MODE=true
fi

if [ "$APPLY_MODE" = true ]; then
    echo "🔧 Fixing Port Forwarding and Browser Access (APPLY MODE)"
else
    echo "🔍 Diagnosing Port Forwarding and Browser Access (ADVISORY MODE)"
    echo "   Run with --apply to make changes"
fi
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
    if [ "$APPLY_MODE" = true ]; then
        print_warning "Dev server is running. Stopping it..."
        pkill -f "vite" || true
        sleep 2
        FIXES_APPLIED=$((FIXES_APPLIED + 1))
    else
        print_warning "Dev server is running. Would stop it with --apply"
    fi
fi

# 2. Check for port conflicts
print_status "Checking for port conflicts..."
for port in "$VITE_PORT" "$API_PORT" 5432 6379; do
    if lsof -i :$port > /dev/null 2>&1; then
        PID=$(lsof -t -i :$port)
        PROCESS=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
        print_warning "Port $port is in use by $PROCESS (PID: $PID)"
        
        if [ "$PROCESS" != "vite" ] && [ "$PROCESS" != "node" ]; then
            if [ "$APPLY_MODE" = true ]; then
                read -p "Kill process on port $port? (y/n): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    kill -9 $PID 2>/dev/null || true
                    print_success "Killed process on port $port"
                    FIXES_APPLIED=$((FIXES_APPLIED + 1))
                fi
            else
                print_warning "Would prompt to kill process on port $port with --apply"
            fi
        fi
    fi
done

# 3. Verify Vite configuration
print_status "Verifying Vite configuration..."
if grep -q "host: '0.0.0.0'" vite.config.ts 2>/dev/null || grep -q "host: true" vite.config.ts 2>/dev/null; then
    print_success "Vite is configured to listen on all interfaces"
else
    print_warning "Vite may need host configuration for external access"
    echo "   Suggestion: Add 'server: { host: true }' to vite.config.ts"
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
        if ! sudo ufw status | grep -q "${VITE_PORT}"; then
            print_status "Adding firewall rule for port ${VITE_PORT}..."
            sudo ufw allow "${VITE_PORT}/tcp"
            FIXES_APPLIED=$((FIXES_APPLIED + 1))
        fi
    fi
else
    print_success "No firewall detected"
fi

# 6. Test localhost connectivity
print_status "Testing localhost connectivity..."
if curl -s "http://localhost:${VITE_PORT}" > /dev/null 2>&1; then
    print_success "Localhost is accessible"
else
    print_warning "Localhost not accessible (server may not be running)"
fi

# 7. Check environment variables
print_status "Checking environment variables..."
if [ -z "$VITE_API_URL" ]; then
    print_warning "VITE_API_URL not set"
    if [ "$APPLY_MODE" = true ]; then
        echo "export VITE_API_URL=http://localhost:${API_PORT}" >> ~/.bashrc
        export VITE_API_URL="http://localhost:${API_PORT}"
        print_success "Added VITE_API_URL to ~/.bashrc"
        FIXES_APPLIED=$((FIXES_APPLIED + 1))
    else
        echo "   Suggestion: export VITE_API_URL=http://localhost:${API_PORT}"
    fi
fi

# 8. Verify package.json scripts
print_status "Verifying package.json scripts..."
if grep -q '"dev":.*--host' package.json; then
    print_success "Dev script includes --host flag"
else
    print_warning "Dev script missing --host flag (optional for external access)"
    echo "   Suggestion: Update dev script to include --host if external access needed"
fi

# 9. Clear Vite cache
print_status "Checking Vite cache..."
if [ -d "node_modules/.vite" ]; then
    if [ "$APPLY_MODE" = true ]; then
        rm -rf node_modules/.vite
        print_success "Vite cache cleared"
        FIXES_APPLIED=$((FIXES_APPLIED + 1))
    else
        print_warning "Vite cache exists. Would clear with --apply"
    fi
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
echo "  1. Run: pnpm run dev"
echo "  2. Access: http://localhost:${VITE_PORT}"
echo "  3. If in container/Codespace, use the forwarded URL"
echo ""
echo "For Playwright/browser testing:"
echo "  - Ensure Playwright browsers are installed: pnpm playwright install"
echo "  - Use headed mode: pnpm playwright test --headed"
echo "  - Or use UI mode: pnpm playwright test --ui"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
