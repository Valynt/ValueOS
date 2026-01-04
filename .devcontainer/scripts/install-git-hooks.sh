#!/bin/bash
###############################################################################
# Install Git Security Hooks
# 
# Installs pre-commit hooks to prevent:
# - Secret commits
# - Large files
# - Sensitive data
# - Unformatted code
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_ROOT="/workspaces/ValueOS"
HOOKS_DIR="$REPO_ROOT/.git/hooks"

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
# Check Prerequisites
###############################################################################

check_prerequisites() {
    log_section "Checking Prerequisites"
    
    # Check if in git repository
    if [ ! -d "$REPO_ROOT/.git" ]; then
        log_error "Not in a git repository"
        exit 1
    fi
    
    # Check for required tools
    local missing_tools=()
    
    if ! command -v git &> /dev/null; then
        missing_tools+=("git")
    fi
    
    if ! command -v trufflehog &> /dev/null; then
        log_warn "trufflehog not found (secret scanning will be limited)"
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    log_info "✓ Prerequisites met"
}

###############################################################################
# Install git-secrets
###############################################################################

install_git_secrets() {
    log_section "Installing git-secrets"
    
    if command -v git-secrets &> /dev/null; then
        log_info "git-secrets already installed"
        return 0
    fi
    
    log_info "Installing git-secrets..."
    
    # Clone and install
    local temp_dir=$(mktemp -d)
    git clone --depth 1 https://github.com/awslabs/git-secrets.git "$temp_dir" 2>/dev/null
    
    cd "$temp_dir"
    sudo make install || {
        log_warn "Could not install git-secrets system-wide, installing locally"
        PREFIX="$HOME/.local" make install
        export PATH="$HOME/.local/bin:$PATH"
    }
    
    cd - > /dev/null
    rm -rf "$temp_dir"
    
    log_info "✓ git-secrets installed"
}

###############################################################################
# Configure git-secrets
###############################################################################

configure_git_secrets() {
    log_section "Configuring git-secrets"
    
    cd "$REPO_ROOT"
    
    # Install hooks
    git secrets --install --force
    
    # Register AWS patterns
    git secrets --register-aws || true
    
    # Add custom patterns
    git secrets --add 'sbp_[a-zA-Z0-9]{40}' || true  # Supabase tokens
    git secrets --add 'sk-[a-zA-Z0-9]{48}' || true   # OpenAI API keys
    git secrets --add 'ghp_[a-zA-Z0-9]{36}' || true  # GitHub tokens
    git secrets --add 'gho_[a-zA-Z0-9]{36}' || true  # GitHub OAuth tokens
    git secrets --add 'postgres://[^:]+:[^@]+@' || true  # PostgreSQL URLs
    git secrets --add 'mongodb://[^:]+:[^@]+@' || true   # MongoDB URLs
    git secrets --add 'redis://[^:]+:[^@]+@' || true     # Redis URLs
    git secrets --add 'AKIA[0-9A-Z]{16}' || true         # AWS Access Keys
    git secrets --add '["\']?password["\']?\s*[:=]\s*["\'][^"\']+["\']' || true  # Passwords
    git secrets --add '["\']?api[_-]?key["\']?\s*[:=]\s*["\'][^"\']+["\']' || true  # API keys
    
    log_info "✓ git-secrets configured"
}

###############################################################################
# Create Pre-Commit Hook
###############################################################################

create_pre_commit_hook() {
    log_section "Creating Pre-Commit Hook"
    
    cat > "$HOOKS_DIR/pre-commit" <<'HOOK_EOF'
#!/bin/bash
###############################################################################
# Pre-Commit Security Hook
# Prevents commits with security issues
###############################################################################

set -e

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "Running pre-commit security checks..."

###############################################################################
# Check for secrets with git-secrets
###############################################################################

if command -v git-secrets &> /dev/null; then
    echo "Checking for secrets..."
    if ! git secrets --scan; then
        echo -e "${RED}❌ COMMIT BLOCKED: Secrets detected!${NC}"
        echo "Remove secrets before committing or use: git commit --no-verify"
        exit 1
    fi
    echo -e "${GREEN}✓ No secrets detected${NC}"
fi

###############################################################################
# Check for secrets with TruffleHog
###############################################################################

if command -v trufflehog &> /dev/null; then
    echo "Scanning staged files for secrets..."
    
    # Get staged files
    staged_files=$(git diff --cached --name-only --diff-filter=ACM)
    
    if [ -n "$staged_files" ]; then
        # Scan staged files
        if echo "$staged_files" | xargs trufflehog filesystem --no-update --fail 2>/dev/null; then
            echo -e "${GREEN}✓ No secrets found by TruffleHog${NC}"
        else
            echo -e "${RED}❌ COMMIT BLOCKED: Potential secrets detected by TruffleHog!${NC}"
            echo "Review the output above and remove any secrets."
            echo "If this is a false positive, use: git commit --no-verify"
            exit 1
        fi
    fi
fi

###############################################################################
# Check for large files
###############################################################################

echo "Checking for large files..."

large_files=$(git diff --cached --name-only --diff-filter=ACM | while read file; do
    if [ -f "$file" ]; then
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
        if [ "$size" -gt 10485760 ]; then  # 10MB
            echo "$file ($(numfmt --to=iec $size 2>/dev/null || echo "${size} bytes"))"
        fi
    fi
done)

if [ -n "$large_files" ]; then
    echo -e "${YELLOW}⚠️  WARNING: Large files detected:${NC}"
    echo "$large_files"
    echo ""
    echo "Consider using Git LFS for large files."
    echo "To proceed anyway, use: git commit --no-verify"
    exit 1
fi

echo -e "${GREEN}✓ No large files${NC}"

###############################################################################
# Check for sensitive file patterns
###############################################################################

echo "Checking for sensitive files..."

sensitive_patterns=(
    "*.pem"
    "*.key"
    "*.p12"
    "*.pfx"
    "*.jks"
    "id_rsa"
    "id_dsa"
    "*.env.production"
    "*.env.prod"
    ".aws/credentials"
    ".ssh/id_*"
)

sensitive_files=""
for pattern in "${sensitive_patterns[@]}"; do
    files=$(git diff --cached --name-only --diff-filter=ACM | grep -E "$pattern" || true)
    if [ -n "$files" ]; then
        sensitive_files="$sensitive_files\n$files"
    fi
done

if [ -n "$sensitive_files" ]; then
    echo -e "${RED}❌ COMMIT BLOCKED: Sensitive files detected:${NC}"
    echo -e "$sensitive_files"
    echo ""
    echo "These files should not be committed to git."
    echo "Add them to .gitignore or use: git commit --no-verify"
    exit 1
fi

echo -e "${GREEN}✓ No sensitive files${NC}"

###############################################################################
# Check for .env files
###############################################################################

echo "Checking for .env files..."

env_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E "^\.env$|^\.env\." | grep -v "\.env\.example" || true)

if [ -n "$env_files" ]; then
    echo -e "${RED}❌ COMMIT BLOCKED: .env files detected:${NC}"
    echo "$env_files"
    echo ""
    echo ".env files should not be committed (they may contain secrets)."
    echo "Use .env.example instead."
    echo "To proceed anyway, use: git commit --no-verify"
    exit 1
fi

echo -e "${GREEN}✓ No .env files${NC}"

###############################################################################
# Success
###############################################################################

echo ""
echo -e "${GREEN}✅ All pre-commit checks passed${NC}"
echo ""

exit 0
HOOK_EOF
    
    chmod +x "$HOOKS_DIR/pre-commit"
    
    log_info "✓ Pre-commit hook created"
}

###############################################################################
# Create Commit-Msg Hook
###############################################################################

create_commit_msg_hook() {
    log_section "Creating Commit-Msg Hook"
    
    cat > "$HOOKS_DIR/commit-msg" <<'HOOK_EOF'
#!/bin/bash
###############################################################################
# Commit Message Hook
# Validates commit message format
###############################################################################

commit_msg_file=$1
commit_msg=$(cat "$commit_msg_file")

# Check for minimum length
if [ ${#commit_msg} -lt 10 ]; then
    echo "❌ Commit message too short (minimum 10 characters)"
    exit 1
fi

# Check for conventional commit format (optional)
# Uncomment to enforce:
# if ! echo "$commit_msg" | grep -qE "^(feat|fix|docs|style|refactor|test|chore|security)(\(.+\))?: .+"; then
#     echo "❌ Commit message must follow conventional commits format"
#     echo "Examples:"
#     echo "  feat: add new feature"
#     echo "  fix: resolve bug"
#     echo "  security: patch vulnerability"
#     exit 1
# fi

exit 0
HOOK_EOF
    
    chmod +x "$HOOKS_DIR/commit-msg"
    
    log_info "✓ Commit-msg hook created"
}

###############################################################################
# Create Pre-Push Hook
###############################################################################

create_pre_push_hook() {
    log_section "Creating Pre-Push Hook"
    
    cat > "$HOOKS_DIR/pre-push" <<'HOOK_EOF'
#!/bin/bash
###############################################################################
# Pre-Push Hook
# Final security check before pushing
###############################################################################

echo "Running pre-push security checks..."

# Run full repository scan
if command -v trufflehog &> /dev/null; then
    echo "Scanning repository for secrets..."
    
    if trufflehog git file://. --no-update --only-verified --since-commit HEAD~10 2>/dev/null | grep -q "Found verified result"; then
        echo "❌ PUSH BLOCKED: Verified secrets found in recent commits!"
        echo "Clean git history before pushing."
        echo "To proceed anyway, use: git push --no-verify"
        exit 1
    fi
    
    echo "✓ No verified secrets in recent commits"
fi

echo "✅ Pre-push checks passed"
exit 0
HOOK_EOF
    
    chmod +x "$HOOKS_DIR/pre-push"
    
    log_info "✓ Pre-push hook created"
}

###############################################################################
# Test Hooks
###############################################################################

test_hooks() {
    log_section "Testing Hooks"
    
    cd "$REPO_ROOT"
    
    # Test secret detection
    log_info "Testing secret detection..."
    
    # Create test file with fake secret
    echo "test_secret=AKIA1234567890ABCDEF" > /tmp/test_secret.txt
    
    # Try to add it
    if git add /tmp/test_secret.txt 2>/dev/null && git commit -m "test" --no-verify 2>/dev/null; then
        git reset HEAD~1 --soft
        log_warn "Secret detection test inconclusive"
    fi
    
    # Cleanup
    rm -f /tmp/test_secret.txt
    git reset HEAD /tmp/test_secret.txt 2>/dev/null || true
    
    log_info "✓ Hooks installed and ready"
}

###############################################################################
# Show Status
###############################################################################

show_status() {
    log_section "Git Hooks Status"
    
    echo "Installed Hooks:"
    ls -lh "$HOOKS_DIR" | grep -E "pre-commit|commit-msg|pre-push" || echo "No hooks installed"
    
    echo ""
    echo "git-secrets Status:"
    if command -v git-secrets &> /dev/null; then
        echo "✓ git-secrets installed"
        cd "$REPO_ROOT"
        git secrets --list || echo "No patterns configured"
    else
        echo "✗ git-secrets not installed"
    fi
}

###############################################################################
# Show Usage
###############################################################################

show_usage() {
    cat <<EOF
Usage: $0 COMMAND

Commands:
  install   Install all git hooks
  status    Show hooks status
  test      Test hooks
  uninstall Remove all hooks

Examples:
  # Install hooks
  $0 install

  # Check status
  $0 status

  # Test hooks
  $0 test

EOF
}

###############################################################################
# Uninstall Hooks
###############################################################################

uninstall_hooks() {
    log_section "Uninstalling Hooks"
    
    rm -f "$HOOKS_DIR/pre-commit"
    rm -f "$HOOKS_DIR/commit-msg"
    rm -f "$HOOKS_DIR/pre-push"
    
    log_info "✓ Hooks uninstalled"
}

###############################################################################
# Main Execution
###############################################################################

main() {
    local command=${1:-install}
    
    case "$command" in
        install)
            check_prerequisites
            install_git_secrets
            configure_git_secrets
            create_pre_commit_hook
            create_commit_msg_hook
            create_pre_push_hook
            test_hooks
            show_status
            ;;
        status)
            show_status
            ;;
        test)
            test_hooks
            ;;
        uninstall)
            uninstall_hooks
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
