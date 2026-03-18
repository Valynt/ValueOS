#!/usr/bin/env bash
# ValueOS DevContainer Post-Start Script
# Runs after the devcontainer starts - performs health checks and setup
# This runs INSIDE the container in a pure Linux environment

set -euo pipefail

log()  { printf '[post-start] %s\n' "$*" >&2; }
warn() { printf '[post-start][WARN] %s\n' "$*" >&2; }
die()  { printf '[post-start][ERROR] %s\n' "$*" >&2; exit 1; }

WS="${WORKSPACE_FOLDER:-/workspaces/ValueOS}"
log "WORKSPACE_FOLDER=${WS}"

cd "$WS" || die "Failed to cd into workspace: $WS"

# ============================================================================
# Health Checks
# ============================================================================
log "Checking service health..."

# Check PostgreSQL
log "Checking PostgreSQL..."
for i in {1..30}; do
  if pg_isready -h postgres -p 5432 -U postgres >/dev/null 2>&1; then
    log "✅ PostgreSQL is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    warn "PostgreSQL is not responding after 30 attempts"
  fi
  sleep 1
done

# Check Redis
log "Checking Redis..."
for i in {1..30}; do
  if redis-cli -h redis ping 2>/dev/null | grep -q PONG; then
    log "✅ Redis is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    warn "Redis is not responding after 30 attempts"
  fi
  sleep 1
done

# Check Supabase Kong
log "Checking Supabase Kong..."
for i in {1..30}; do
  if curl -s http://kong:8000/health >/dev/null 2>&1 || curl -s http://kong:8000 >/dev/null 2>&1; then
    log "✅ Kong is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    warn "Kong is not responding after 30 attempts"
  fi
  sleep 1
done

# ============================================================================
# Database Migrations
# ============================================================================
log "Applying database migrations..."
if command -v pnpm &> /dev/null && [[ -f "package.json" ]]; then
  if pnpm run db:migrate 2>&1; then
    log "✅ Database migrations applied"
  else
    warn "Database migrations failed — run manually: pnpm run db:migrate"
  fi
else
  warn "pnpm or package.json not found — skipping migrations"
fi

# ============================================================================
# Environment Verification
# ============================================================================
log "Verifying environment..."

# Check Node.js
if ! command -v node &> /dev/null; then
  die "Node.js is not installed"
fi
log "✅ Node.js $(node --version)"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  die "pnpm is not installed"
fi
log "✅ pnpm $(pnpm --version)"

# Check that dependencies are installed
if [ ! -d "node_modules" ]; then
  warn "node_modules not found. Run: pnpm install"
fi

# ============================================================================
# Service Status Summary
# ============================================================================
log ""
log "========================================"
log "ValueOS DevContainer Ready!"
log "========================================"
log ""
log "Available Services:"
log "  - Frontend (Vite):    http://localhost:${FRONTEND_PORT:-5173}"
log "  - Backend API:        http://localhost:${BACKEND_PORT:-3001}"
log "  - Supabase Kong:      http://localhost:${KONG_PROXY_PORT:-54321}"
log "  - Supabase Studio:    http://localhost:${STUDIO_PORT:-54324}"
log "  - Kong Admin:         http://localhost:${KONG_ADMIN_PORT:-8001}"
log "  - MailHog Web:        http://localhost:8025"
log ""
log "Database:"
log "  - PostgreSQL:         postgres:5432 (internal)"
log "  - Redis:              redis:6379 (internal)"
log ""
log "Quick Commands:"
log "  pnpm dev              Start development servers"
log "  pnpm test             Run tests"
log "  pnpm lint             Run linter"
log "  make -f .devcontainer/Makefile help  See all make commands"
log ""
log "========================================"

log "post-start complete"
