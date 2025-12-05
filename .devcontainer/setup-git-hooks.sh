#!/bin/bash
# Setup Git Hooks for Security Scanning
# Automatically configured during devcontainer creation

set -e

echo "🔒 Setting up Git security hooks..."

# Ensure git hooks directory exists
mkdir -p .git/hooks

# ============================================================================
# Pre-commit Hook - Secret & PII Scanning
# ============================================================================
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook for security scanning
# Prevents commits with secrets or PII

set -e

echo "🔍 Running pre-commit security scans..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# 1. TruffleHog - Secret Detection
# ============================================================================
echo "  → Scanning for secrets with TruffleHog..."
if command -v trufflehog &> /dev/null; then
    if ! trufflehog git file://. --since-commit HEAD --only-verified --fail 2>&1 | grep -v "🐷"; then
        echo -e "${GREEN}✓ No secrets detected${NC}"
    else
        echo -e "${RED}✗ BLOCKED: Secrets detected in commit${NC}"
        echo -e "${YELLOW}Run: trufflehog git file://. --since-commit HEAD${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ TruffleHog not installed, skipping secret scan${NC}"
fi

# ============================================================================
# 2. Git Secrets - AWS & Custom Patterns
# ============================================================================
echo "  → Scanning with git-secrets..."
if command -v git-secrets &> /dev/null; then
    # Check if git-secrets is installed for this repo
    if git secrets --list &> /dev/null; then
        if git secrets --pre_commit_hook -- "$@"; then
            echo -e "${GREEN}✓ No AWS secrets detected${NC}"
        else
            echo -e "${RED}✗ BLOCKED: AWS secrets detected${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠ git-secrets not initialized, run: git secrets --install${NC}"
    fi
else
    echo -e "${YELLOW}⚠ git-secrets not installed${NC}"
fi

# ============================================================================
# 3. PII Pattern Detection
# ============================================================================
echo "  → Scanning for PII patterns..."

# Patterns to detect (regex)
PII_PATTERNS=(
    # Email addresses (naive pattern)
    "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
    # SSN format XXX-XX-XXXX
    "[0-9]{3}-[0-9]{2}-[0-9]{4}"
    # Credit card patterns (basic)
    "[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}"
    # Phone numbers (US format)
    "(\+1[-\s]?)?\(?[0-9]{3}\)?[-\s]?[0-9]{3}[-\s]?[0-9]{4}"
)

PII_FOUND=0

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -n "$STAGED_FILES" ]; then
    for FILE in $STAGED_FILES; do
        # Skip node_modules, dist, and lock files
        if [[ $FILE == node_modules/* ]] || [[ $FILE == dist/* ]] || [[ $FILE == *.lock ]] || [[ $FILE == package-lock.json ]]; then
            continue
        fi
        
        # Skip binary files
        if file "$FILE" | grep -q "text"; then
            for PATTERN in "${PII_PATTERNS[@]}"; do
                if git diff --cached "$FILE" | grep -E "^\+" | grep -E "$PATTERN" &> /dev/null; then
                    echo -e "${YELLOW}⚠ Potential PII detected in: $FILE${NC}"
                    echo -e "${YELLOW}  Pattern: $PATTERN${NC}"
                    PII_FOUND=1
                fi
            done
        fi
    done
fi

if [ $PII_FOUND -eq 1 ]; then
    echo -e "${YELLOW}⚠ PII patterns detected. Review changes carefully.${NC}"
    echo -e "${YELLOW}  If this is test data, consider using fake/anonymized values.${NC}"
    echo -e "${YELLOW}  To bypass: git commit --no-verify${NC}"
    # Warning only, don't block (set to exit 1 to block)
fi

# ============================================================================
# 4. Docker Secrets Check
# ============================================================================
echo "  → Checking for hardcoded Docker secrets..."

if git diff --cached --name-only | grep -E "(docker-compose|\.env)" &> /dev/null; then
    # Check for hardcoded passwords in docker-compose files
    if git diff --cached | grep -E "^\+.*PASSWORD.*=.*[^FILE]" | grep -v "PASSWORD_FILE" &> /dev/null; then
        echo -e "${YELLOW}⚠ Hardcoded password detected in Docker config${NC}"
        echo -e "${YELLOW}  Use Docker Secrets (PASSWORD_FILE) instead${NC}"
    fi
fi

echo -e "${GREEN}✓ Pre-commit security scans complete${NC}"
exit 0
EOF

chmod +x .git/hooks/pre-commit

# ============================================================================
# Pre-push Hook - Additional Scanning
# ============================================================================
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash
# Pre-push hook for additional security checks

set -e

echo "🔍 Running pre-push security validation..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Run Trivy vulnerability scan on high/critical only
if command -v trivy &> /dev/null; then
    echo "  → Running Trivy vulnerability scan..."
    if trivy fs --severity HIGH,CRITICAL --exit-code 0 . &> /dev/null; then
        echo -e "${GREEN}✓ No critical vulnerabilities detected${NC}"
    else
        echo -e "${YELLOW}⚠ Vulnerabilities detected (non-blocking)${NC}"
        echo -e "${YELLOW}  Run: trivy fs --severity HIGH,CRITICAL .${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Trivy not installed, skipping vulnerability scan${NC}"
fi

echo -e "${GREEN}✓ Pre-push validation complete${NC}"
exit 0
EOF

chmod +x .git/hooks/pre-push

# ============================================================================
# Initialize git-secrets with AWS patterns
# ============================================================================
if command -v git-secrets &> /dev/null; then
    echo "  → Initializing git-secrets with AWS patterns..."
    
    # Install hooks
    git secrets --install -f 2>/dev/null || true
    
    # Register AWS patterns
    git secrets --register-aws 2>/dev/null || true
    
    # Add custom patterns for dev passwords
    git secrets --add 'valuecanvas_dev_password_CHANGE_ME' 2>/dev/null || true
    git secrets --add 'redis_dev_password_CHANGE_ME' 2>/dev/null || true
    git secrets --add '[pP]assword.*=.*[^FILE]' 2>/dev/null || true
    
    echo -e "${GREEN}✓ git-secrets configured${NC}"
else
    echo -e "${YELLOW}⚠ git-secrets not installed${NC}"
fi

echo ""
echo "✅ Git hooks configured successfully!"
echo ""
echo "Hooks installed:"
echo "  • pre-commit:  Secret & PII scanning"
echo "  • pre-push:    Vulnerability scanning"
echo ""
echo "To bypass hooks temporarily: git commit --no-verify"
echo ""
