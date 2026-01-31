#!/bin/bash
###############################################################################
# Dev Container - On Create Script
# Runs once when the container is first created
#
# Design principles:
# - Fail fast on critical errors, continue on non-critical
# - Idempotent: safe to run multiple times
# - Timeout protection on network operations
# - Clear error messages with recovery hints
###############################################################################

set -euo pipefail

# Trap for cleanup on error
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo ""
        echo "❌ on-create.sh failed with exit code $exit_code"
        echo "   Check the error above and re-run the devcontainer build"
    fi
}
trap cleanup EXIT

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/on-create.log"
MAX_RETRIES=3
NETWORK_TIMEOUT=30

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    YELLOW='\033[1;33m'
    RED='\033[0;31m'
    NC='\033[0m'
else
    GREEN='' BLUE='' YELLOW='' RED='' NC=''
fi

###############################################################################
# Logging Functions
###############################################################################

log_info() {
    echo -e "${BLUE}▶${NC} $1"
    echo "[$(date -Iseconds)] INFO: $1" >> "$LOG_FILE" 2>/dev/null || true
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
    echo "[$(date -Iseconds)] SUCCESS: $1" >> "$LOG_FILE" 2>/dev/null || true
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    echo "[$(date -Iseconds)] WARN: $1" >> "$LOG_FILE" 2>/dev/null || true
}

log_error() {
    echo -e "${RED}✗${NC} $1" >&2
    echo "[$(date -Iseconds)] ERROR: $1" >> "$LOG_FILE" 2>/dev/null || true
}

###############################################################################
# Utility Functions
###############################################################################

# Retry a command with exponential backoff
retry_command() {
    local max_attempts=$1
    local delay=1
    shift
    local cmd="$*"
    
    for ((attempt=1; attempt<=max_attempts; attempt++)); do
        if eval "$cmd"; then
            return 0
        fi
        
        if [ $attempt -lt $max_attempts ]; then
            log_warn "Attempt $attempt/$max_attempts failed, retrying in ${delay}s..."
            sleep $delay
            delay=$((delay * 2))
        fi
    done
    
    return 1
}

# Check if a command exists
command_exists() {
    command -v "$1" &>/dev/null
}

# Safe directory creation (idempotent)
ensure_dir() {
    local dir="$1"
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
    fi
}

###############################################################################
# Setup Functions
###############################################################################

setup_logging() {
    ensure_dir "$(dirname "$LOG_FILE")"
    echo "=== on-create.sh started at $(date -Iseconds) ===" >> "$LOG_FILE" 2>/dev/null || true
}

configure_git() {
    log_info "Configuring Git..."
    
    # Core settings (idempotent)
    git config --global init.defaultBranch main 2>/dev/null || true
    git config --global pull.rebase false 2>/dev/null || true
    git config --global core.autocrlf input 2>/dev/null || true
    git config --global core.fileMode false 2>/dev/null || true
    
    # Safe directory for workspace
    git config --global --add safe.directory "${PROJECT_ROOT}" 2>/dev/null || true
    
    log_success "Git configured"
}

setup_git_hooks() {
    log_info "Setting up Git hooks..."
    
    if [ -f "${PROJECT_ROOT}/.devcontainer/setup-git-hooks.sh" ]; then
        if bash "${PROJECT_ROOT}/.devcontainer/setup-git-hooks.sh" 2>/dev/null; then
            log_success "Git hooks installed"
        else
            log_warn "Git hooks setup failed (non-critical)"
        fi
    else
        log_success "No custom git hooks to install"
    fi
}

setup_directories() {
    log_info "Creating workspace directories..."
    
    local dirs=(
        "${PROJECT_ROOT}/.cache"
        "${PROJECT_ROOT}/logs"
        "${PROJECT_ROOT}/tmp"
        "${PROJECT_ROOT}/coverage"
        "${PROJECT_ROOT}/dist"
        "${HOME}/.local/bin"
    )
    
    for dir in "${dirs[@]}"; do
        ensure_dir "$dir"
    done
    
    log_success "Directories created"
}

setup_environment_files() {
    log_info "Setting up environment files..."
    
    # Create .env from .env.example if missing (idempotent)
    if [ ! -f "${PROJECT_ROOT}/.env" ] && [ -f "${PROJECT_ROOT}/.env.example" ]; then
        cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env"
        log_success "Created .env from .env.example"
    elif [ -f "${PROJECT_ROOT}/.env" ]; then
        log_success ".env already exists"
    else
        log_warn "No .env.example found, skipping .env creation"
    fi
}

install_global_tools() {
    log_info "Checking global tools..."
    
    # Supabase CLI (optional, non-critical)
    if ! command_exists supabase; then
        log_info "Installing Supabase CLI..."
        if retry_command $MAX_RETRIES "pnpm install -g supabase --silent 2>/dev/null"; then
            log_success "Supabase CLI installed"
        else
            log_warn "Supabase CLI installation failed (non-critical)"
        fi
    else
        log_success "Supabase CLI already available"
    fi
}

install_doppler_cli() {
    log_info "Checking Doppler CLI..."
    
    if command_exists doppler; then
        log_success "Doppler CLI already available"
        return 0
    fi
    
    # Doppler is optional for development
    log_info "Installing Doppler CLI..."
    if timeout $NETWORK_TIMEOUT bash -c 'curl -Ls https://cli.doppler.com/install.sh | sh' 2>/dev/null; then
        export PATH="${HOME}/bin:$PATH"
        log_success "Doppler CLI installed"
    else
        log_warn "Doppler CLI installation failed (non-critical, secrets can be managed via .env)"
    fi
}

setup_shell_completions() {
    log_info "Setting up shell completions..."
    
    # kubectl completions (optional)
    if command_exists kubectl; then
        local completion_dir="${HOME}/.oh-my-zsh/completions"
        if [ -d "$completion_dir" ]; then
            kubectl completion zsh > "${completion_dir}/_kubectl" 2>/dev/null || true
        fi
    fi
    
    log_success "Shell completions configured"
}

setup_shell_aliases() {
    log_info "Creating shell aliases..."
    
    local rc_file="${HOME}/.zshrc"
    [ ! -f "$rc_file" ] && rc_file="${HOME}/.bashrc"
    
    # Check if aliases already added (idempotent)
    if grep -q "# ValueOS Development Aliases" "$rc_file" 2>/dev/null; then
        log_success "Aliases already configured"
        return 0
    fi
    
    cat >> "$rc_file" << 'ALIASES'

# ValueOS Development Aliases
alias dev-up="pnpm run dx"
alias dev-down="pnpm run dx:down"
alias dev-logs="pnpm run dx:logs"
alias dev-ps="pnpm run dx:ps"
alias dev-health="pnpm run health"

# Database aliases
alias db-connect="docker exec -it valueos-postgres psql -U postgres -d valuecanvas_dev"
alias redis-connect="docker exec -it valueos-redis redis-cli"

# Development helpers
alias dc='docker compose'
alias k='kubectl'
alias npm-clean='rm -rf node_modules package-lock.json && pnpm install'
alias dev='pnpm run dev'
alias test='pnpm test'
alias build='pnpm run build'
alias lint='pnpm run lint'

# Git aliases
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline --graph --decorate -10'

# Quick navigation
alias ws='cd /workspaces'
ALIASES
    
    log_success "Aliases created"
}

create_health_check_script() {
    log_info "Creating health check script..."
    
    local bin_dir="${HOME}/.local/bin"
    ensure_dir "$bin_dir"
    
    cat > "${bin_dir}/valueos-health" << 'HEALTHSCRIPT'
#!/bin/bash
# ValueOS Health Check - Quick status of all services

echo "ValueOS Health Check"
echo "===================="

check_service() {
    local name=$1
    local url=$2
    local timeout=${3:-2}
    
    if curl -sf --max-time "$timeout" "$url" >/dev/null 2>&1; then
        echo "✓ $name: healthy"
        return 0
    else
        echo "✗ $name: not responding"
        return 1
    fi
}

check_docker_service() {
    local name=$1
    local container=$2
    local check_cmd=$3
    
    if docker exec "$container" $check_cmd >/dev/null 2>&1; then
        echo "✓ $name: healthy"
        return 0
    else
        echo "✗ $name: not responding"
        return 1
    fi
}

# Check services
check_service "Frontend" "http://localhost:5173" || true
check_service "Backend" "http://localhost:3001/health" || true
check_docker_service "PostgreSQL" "valueos-postgres" "pg_isready -U postgres" || true
check_docker_service "Redis" "valueos-redis" "redis-cli ping" || true

echo ""
echo "Run 'pnpm run dx' to start all services"
HEALTHSCRIPT
    
    chmod +x "${bin_dir}/valueos-health"
    log_success "Health check script created"
}

###############################################################################
# Main
###############################################################################

main() {
    echo ""
    echo "========================================"
    echo "  ValueOS Dev Container - On Create"
    echo "========================================"
    echo ""
    
    cd "$PROJECT_ROOT"
    
    setup_logging
    configure_git
    setup_git_hooks
    setup_directories
    setup_environment_files
    install_global_tools
    install_doppler_cli
    setup_shell_completions
    setup_shell_aliases
    create_health_check_script
    
    echo ""
    echo "========================================"
    echo "  ✓ On-create setup complete!"
    echo "========================================"
    echo ""
}

main "$@"
