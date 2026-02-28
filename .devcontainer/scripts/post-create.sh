#!/usr/bin/env bash
set -euo pipefail

# Source shared environment setup (prefer env-setup.sh)
# shellcheck source=/dev/null
if [[ -f .devcontainer/scripts/env-setup.sh ]]; then
    source ".devcontainer/scripts/env-setup.sh"
elif [[ -f .devcontainer/scripts/env.sh ]]; then
    source ".devcontainer/scripts/env.sh"
fi

log()  { printf '[post-create] %s\n' "$*" >&2; }
die()  { printf '[post-create][ERROR] %s\n' "$*" >&2; exit 1; }

: "${WORKSPACE_FOLDER:?WORKSPACE_FOLDER is not set}"
[[ -d "$WORKSPACE_FOLDER" ]] || die "Workspace not found: $WORKSPACE_FOLDER"
cd "$WORKSPACE_FOLDER" || die "Failed to cd into workspace: $WORKSPACE_FOLDER"

# post-create.sh
# Runs after on-create, performs additional setup tasks

log "Running post-create setup..."

# --- Preflight (fail loudly if workspace not mounted correctly) ---
if [ ! -d "$WORKSPACE_FOLDER" ]; then
  die "Workspace not found: $WORKSPACE_FOLDER"
fi

cd "$WORKSPACE_FOLDER" || die "Failed to cd into workspace: $WORKSPACE_FOLDER"

if [ ! -d ".git" ]; then
  die "Missing .git in workspace (${WORKSPACE_FOLDER}) — post-create expects a mounted repository"
fi

if [ ! -d ".devcontainer/scripts" ]; then
  die "Missing .devcontainer/scripts in workspace (${WORKSPACE_FOLDER}/.devcontainer/scripts) — expected devcontainer scripts to be present"
fi

# Ensure devcontainer scripts are executable (safe, idempotent)
if [ -d .devcontainer/scripts ]; then
    log "Making .devcontainer/scripts/*.sh executable"
    find .devcontainer/scripts -type f -name "*.sh" -exec chmod +x {} + || warn "chmod on .devcontainer/scripts failed"
fi

# Load environment variables
load_environment

# Verify pnpm setup
verify_pnpm

# Install workspace dependencies (moved from on-create)
log "Installing workspace dependencies (post-create)..."
if [ -f pnpm-lock.yaml ]; then
  log "Installing pnpm dependencies (frozen lockfile)"
  pnpm install --frozen-lockfile || die "pnpm install failed"
else
  log "Installing pnpm dependencies (no lockfile)"
  pnpm install || die "pnpm install failed"
fi

# Ensure global dev tools (safe to run after pnpm available)
if ! command -v tsx &> /dev/null; then
  log "Installing tsx globally..."
  pnpm add -g tsx || warn "failed to install tsx globally"
fi

# Setup git hooks if using husky
if [ -d .husky ]; then
  log "Setting up git hooks..."
  pnpm exec husky install || warn "husky install failed"
fi

# =============================================================================
# BUILD VERIFICATION
# =============================================================================

log "Verifying build configuration..."

# Check if TypeScript config is valid
if [ -f tsconfig.json ]; then
    log "TypeScript configuration found"
fi

# Check if package.json exists
if [ -f package.json ]; then
    log "Package configuration found"
fi

# =============================================================================
# HEALTH CHECKS
# =============================================================================

log "Running health checks..."

# Database health check
database_health_check

# Apply DB migrations (post-create is the right place)
if [ -f infra/scripts/apply_migrations.sh ]; then
  log "Applying database migrations (post-create)..."
  bash infra/scripts/apply_migrations.sh || warn "apply_migrations.sh failed (continuing)"
else
  log "No infra/scripts/apply_migrations.sh found — skipping migrations"
fi

# Check Redis
if redis-cli -h localhost -p "${REDIS_PORT:-6379}" -a "${REDIS_PASSWORD:-valueos_dev}" ping > /dev/null 2>&1; then
    log "Redis is healthy"
else
    log "Redis health check failed"
fi

# Check Kong
if curl -f http://localhost:8001/ > /dev/null 2>&1; then
    log "Kong is healthy"
else
    log "Kong health check failed"
fi

# =============================================================================
# SEED DATA (OPTIONAL)
# =============================================================================

if [ "${SEED_DATABASE:-false}" = "true" ]; then
    log "Seeding database..."

    if [ -f scripts/seed.sh ]; then
        bash scripts/seed.sh
        log "Database seeded"
    else
        log "Seed script not found, skipping"
    fi
fi

# =============================================================================
# COMPLETION
# =============================================================================

log ""
log "post-create setup completed!"
log ""

# =============================================================================
# BUILD VERIFICATION
# =============================================================================

echo "🏗️  Verifying build configuration..."

# Check if TypeScript config is valid
if [ -f tsconfig.json ]; then
    echo "✅ TypeScript configuration found"
fi

# Check if package.json exists
if [ -f package.json ]; then
    echo "✅ Package configuration found"
fi


# Verify Corepack-managed pnpm availability
echo "📦 Verifying Corepack pnpm setup..."
if command -v corepack > /dev/null 2>&1; then
    if [ -x .devcontainer/scripts/read-version.sh ]; then
        PNPM_VERSION="$(.devcontainer/scripts/read-version.sh pnpm)"
    else
        PNPM_VERSION="9.15.0"
    fi
    corepack enable
    corepack prepare "pnpm@${PNPM_VERSION}" --activate
fi
if command -v pnpm > /dev/null 2>&1; then
    echo "✅ pnpm is available: $(pnpm --version)"
else
    echo "❌ pnpm is not available after post-create setup"
    exit 1
fi

# =============================================================================
# HEALTH CHECKS
# =============================================================================

echo "🏥 Running health checks..."

# Parse DATABASE_URL to get connection details
parse_database_url() {
    local url="$1"
    # Remove postgresql://
    local without_proto="${url#postgresql://}"
    # Extract user:pass
    local user_pass="${without_proto%%@*}"
    DB_USER="${user_pass%%:*}"
    DB_PASS="${user_pass#*:}"
    # Extract host:port/db
    local host_port_db="${without_proto#*@}"
    DB_HOST="${host_port_db%%:*}"
    local port_db="${host_port_db#*:}"
    DB_PORT="${port_db%%/*}"
    DB_NAME="${port_db#*/}"
}

if [ -n "${DATABASE_URL:-}" ]; then
    parse_database_url "$DATABASE_URL"
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DB_USER="${DB_USER:-postgres}"
    DB_PASS="${DB_PASS:-valueos_dev}"
    DB_NAME="${DB_NAME:-valueos_dev}"
else
    DB_HOST="${POSTGRES_HOST:-localhost}"
    DB_PORT="${POSTGRES_PORT:-5432}"
    DB_USER="${POSTGRES_USER:-valueos}"
    DB_PASS="${POSTGRES_PASSWORD:-valueos_dev}"
    DB_NAME="${POSTGRES_DB:-valueos_dev}"
fi

# Check PostgreSQL
if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1; then
    echo "✅ PostgreSQL is healthy"
else
    echo "⚠️  PostgreSQL health check failed"
fi

# Check Redis
if redis-cli -h localhost -p "${REDIS_PORT:-6379}" -a "${REDIS_PASSWORD:-valueos_dev}" ping > /dev/null 2>&1; then
    echo "✅ Redis is healthy"
else
    echo "⚠️  Redis health check failed"
fi

# Check Kong
if curl -f http://localhost:8001/ > /dev/null 2>&1; then
    echo "✅ Kong is healthy"
else
    echo "⚠️  Kong health check failed"
fi

# =============================================================================
# SEED DATA (OPTIONAL)
# =============================================================================

if [ "${SEED_DATABASE:-false}" = "true" ]; then
    echo "🌱 Seeding database..."

    if [ -f scripts/seed.sh ]; then
        bash scripts/seed.sh
        echo "✅ Database seeded"
    else
        echo "⚠️  Seed script not found, skipping"
    fi
fi

# =============================================================================
# COMPLETION
# =============================================================================

echo ""
echo "✅ post-create setup completed!"
echo ""
