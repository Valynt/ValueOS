#!/bin/bash
##############################################################################
# Setup Security Scanning Tools
# Installs and configures security scanning tools for the development container
##############################################################################

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

echo "🔒 Setting up Security Scanning Tools..."
echo ""

# 1. Make security scan script executable
print_status "Making security scan script executable..."
chmod +x .devcontainer/scripts/security-scan.sh
print_success "Security scan script is now executable"

# 2. Create security scanning aliases
print_status "Creating security scanning aliases..."
cat >> ~/.zshrc << 'EOF'

# Security Scanning Aliases
alias security-scan="bash .devcontainer/scripts/security-scan.sh"
alias security-scan-containers="trivy image --severity HIGH,CRITICAL prom/prometheus:v2.47.0 grafana/grafana:10.1.0"
alias security-scan-secrets="trufflehog filesystem . --json"
alias security-scan-deps="snyk test --severity-threshold=high"
alias security-reports="ls -la /workspace/security-reports/"

# Quick security commands
alias check-vulns="security-scan"
alias check-secrets="security-scan-secrets"
alias check-deps="security-scan-deps"

EOF
print_success "Security scanning aliases created"

# 3. Create security monitoring script
print_status "Creating security monitoring script..."
mkdir -p /workspace/.local/bin
cat > /workspace/.local/bin/security-monitor << 'EOF'
#!/bin/bash
echo "🔍 ValueOS Security Monitor"
echo "========================"

# Check for recent security issues
echo ""
echo "📊 Recent Security Reports:"
if [ -d "/workspace/security-reports" ]; then
    ls -la /workspace/security-reports/ | head -10
else
    echo "No security reports found. Run 'security-scan' to generate reports."
fi

echo ""
echo "🛡️  Security Status:"
echo "  • Trivy: $(command -v trivy &> /dev/null && echo "Installed" || echo "Not installed")"
echo "  • TruffleHog: $(command -v trufflehog &> /dev/null && echo "Installed" || echo "Not installed")"
echo "  • Snyk: $(command -v snyk &> /dev/null && echo "Installed" || echo "Not installed")"
echo "  • Hadolint: $(command -v hadolint &> /dev/null && echo "Installed" || echo "Not installed")"

echo ""
echo "🚀 Quick Actions:"
echo "  • Run full security scan: security-scan"
echo "  • Check container vulnerabilities: security-scan-containers"
echo "  • Scan for secrets: security-scan-secrets"
echo "  • Check dependencies: security-scan-deps"
EOF
chmod +x /workspace/.local/bin/security-monitor
print_success "Security monitoring script created"

# 4. Add security scan to on-create script (optional)
print_status "Adding security scan to development workflow..."
echo ""
echo "💡 Security scanning is now set up!"
echo ""
echo "📋 Available Commands:"
echo "  security-scan           - Run comprehensive security scan"
echo "  security-monitor        - Show security status and recent reports"
echo "  security-scan-containers - Scan container images for vulnerabilities"
echo "  security-scan-secrets   - Scan codebase for secrets"
echo "  security-scan-deps      - Scan dependencies for vulnerabilities"
echo ""
echo "📁 Security reports will be saved to: /workspace/security-reports/"
echo ""
echo "🔔 Recommended: Run 'security-scan' weekly or before major deployments"
echo ""
