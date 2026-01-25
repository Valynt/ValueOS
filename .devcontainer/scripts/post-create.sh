#!/bin/bash
###############################################################################
# Dev Container - Post Create Script
# Runs after container is created and content is updated
#
# Design principles:
# - Reproducible: uses npm ci with lockfile
# - Failsafe: non-critical steps don't block setup
# - Idempotent: safe to run multiple times
# - Timeout protection on long operations
###############################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/post-create.log"
NPM_INSTALL_TIMEOUT=300
BUILD_TIMEOUT=120

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

command_exists() {
    command -v "$1" &>/dev/null
}

# Run command with timeout, return success/failure
run_with_timeout() {
    local timeout_secs=$1
    shift

    if command_exists timeout; then
        timeout "$timeout_secs" "$@"
    else
        "$@"
    fi
}

###############################################################################
# Setup Functions
###############################################################################

setup_logging() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    echo "=== post-create.sh started at $(date -Iseconds) ===" >> "$LOG_FILE" 2>/dev/null || true
}

install_dependencies() {
    log_info "Installing project dependencies..."

    if [ ! -f "${PROJECT_ROOT}/package.json" ]; then
        log_warn "No package.json found, skipping dependency installation"
        return 0
    fi

    cd "$PROJECT_ROOT"

    if [ -f "pnpm-lock.yaml" ]; then
        log_info "Using pnpm for reproducible install..."

        if command_exists corepack; then
            corepack enable >/dev/null 2>&1 || true
            corepack prepare pnpm@9.15.4 --activate >/dev/null 2>&1 || true
        fi

        if run_with_timeout $NPM_INSTALL_TIMEOUT pnpm install --frozen-lockfile --prefer-offline 2>&1; then
            log_success "Dependencies installed (reproducible)"
        else
            log_error "Dependency installation failed"
            return 1
        fi
        return 0
    fi

    # Fallback for legacy setups
    if [ -f "package-lock.json" ]; then
        log_info "Using npm ci for reproducible install..."
        if run_with_timeout $NPM_INSTALL_TIMEOUT npm ci --prefer-offline --no-audit --no-fund 2>&1; then
            log_success "Dependencies installed (reproducible)"
        else
            log_warn "npm ci failed, falling back to npm install..."
            if run_with_timeout $NPM_INSTALL_TIMEOUT npm install --prefer-offline --no-audit --no-fund 2>&1; then
                log_success "Dependencies installed (npm install fallback)"
            else
                log_error "Dependency installation failed"
                return 1
            fi
        fi
    else
        log_warn "No lockfile found, using npm install"
        if run_with_timeout $NPM_INSTALL_TIMEOUT npm install --no-audit --no-fund 2>&1; then
            log_success "Dependencies installed"
        else
            log_error "Dependency installation failed"
            return 1
        fi
    fi
}

generate_prisma_client() {
    local schema_paths=(
        "${PROJECT_ROOT}/scripts/prisma/schema.prisma"
        "${PROJECT_ROOT}/prisma/schema.prisma"
    )

    for schema_path in "${schema_paths[@]}"; do
        if [ -f "$schema_path" ]; then
            log_info "Generating Prisma client from ${schema_path}..."
            # Run non-interactive and capture output to the post-create log to avoid prompts
            if npx --yes prisma generate --schema="$schema_path" >> "$LOG_FILE" 2>&1; then
                log_success "Prisma client generated"
            else
                log_warn "Prisma client generation failed (non-critical). See $LOG_FILE for details"
            fi
            return 0
        fi
    done

    # No schema found, skip silently
    return 0
}

setup_husky_hooks() {
    if [ -d "${PROJECT_ROOT}/.husky" ]; then
        log_info "Setting up Husky hooks..."
        if npx husky install 2>/dev/null; then
            log_success "Husky hooks configured"
        else
            log_warn "Husky setup failed (non-critical)"
        fi
    fi
}

verify_typescript() {
    if [ ! -f "${PROJECT_ROOT}/tsconfig.json" ]; then
        return 0
    fi

    log_info "Verifying TypeScript configuration..."

    # Just check that tsc can parse the config, don't do full build
    if npx tsc --noEmit --pretty false 2>/dev/null; then
        log_success "TypeScript configuration valid"
    else
        log_warn "TypeScript has errors (can be fixed later)"
    fi
}

verify_environment() {
    log_info "Verifying development environment..."

    local errors=0

    # Critical: Node.js
    if command_exists node; then
        local node_version
        node_version=$(node --version 2>/dev/null || echo "unknown")
        log_success "Node.js: $node_version"
    else
        log_error "Node.js not found"
        errors=$((errors + 1))
    fi

    # Critical: npm
    if command_exists npm; then
        local npm_version
        npm_version=$(npm --version 2>/dev/null || echo "unknown")
        log_success "npm: $npm_version"
    else
        log_error "npm not found"
        errors=$((errors + 1))
    fi

    # Optional: Docker
    if command_exists docker; then
        log_success "Docker: available"
    else
        log_warn "Docker not available (some features may not work)"
    fi

    # Optional: kubectl
    if command_exists kubectl; then
        log_success "kubectl: available"
    fi

    # Optional: Supabase CLI
    if command_exists supabase || npx supabase --version &>/dev/null 2>&1; then
        log_success "Supabase CLI: available"
    fi

    return $errors
}

print_summary() {
    echo ""
    echo "========================================"
    echo "  Development Environment Ready"
    echo "========================================"
    echo ""
    echo "Quick Start:"
    echo "  npm run dx           - Start full dev environment"
    echo "  npm run dev          - Start frontend only"
    echo "  npm run backend:dev  - Start backend only"
    echo "  npm test             - Run tests"
    echo ""
    echo "Useful Commands:"
    echo "  npm run dx:doctor    - Check environment health"
    echo "  npm run dx:down      - Stop all services"
    echo "  npm run dx:logs      - View service logs"
    echo ""
    echo "Documentation:"
    echo "  docs/                - Project documentation"
    echo "  .devcontainer/       - Container configuration"
    echo ""
    echo "========================================"
    echo ""
}

###############################################################################
# Main
###############################################################################

main() {
    echo ""
    echo "========================================"
    echo "  ValueOS Dev Container - Post Create"
    echo "========================================"
    echo ""

    cd "$PROJECT_ROOT"

    setup_logging

    # Critical step - fail if this fails
    install_dependencies || {
        log_error "Failed to install dependencies. Check network and try again."
        exit 1
    }

    # Non-critical steps - continue on failure
    generate_prisma_client
    setup_husky_hooks
    verify_typescript

    # Verify environment - warn but don't fail
    verify_environment || log_warn "Some environment checks failed"

    print_summary

        # Optional: install heavy developer/security tooling if explicitly opted-in
        if [ "${INSTALL_OPTIONAL_TOOLS:-false}" = "true" ]; then
            log_info "INSTALL_OPTIONAL_TOOLS=true detected — running optional tools installer"
            if bash ".devcontainer/scripts/install-optional-tools.sh" 2>&1 | tee -a "$LOG_FILE"; then
                log_success "Optional tools installed"
            else
                log_warn "Optional tools installation encountered errors (see log)"
            fi
        else
            log_info "Optional tools not requested (set INSTALL_OPTIONAL_TOOLS=true to enable)"
        fi
}

main "$@"
