#!/bin/bash
set -euo pipefail

# on-create.sh
# Runs once when the DevContainer is created
# Performs initial setup and configuration

echo "🔧 Running on-create setup..."

# =============================================================================
# ENVIRONMENT SETUP
# =============================================================================

# Load environment variables
if [ -f .devcontainer/.env ]; then
    echo "📋 Loading environment variables..."
    export $(grep -v '^#' .devcontainer/.env | xargs)
else
    echo "⚠️  No .env file found, using defaults"
    cp .devcontainer/.env.template .devcontainer/.env
    echo "✅ Created .env from template"
fi

# =============================================================================
# DEPENDENCY INSTALLATION
# =============================================================================

echo "📦 Installing dependencies..."

# Enable pnpm
corepack enable
corepack prepare pnpm@latest --activate

# Install workspace dependencies
if [ -f pnpm-lock.yaml ]; then
    echo "📥 Installing pnpm dependencies..."
    pnpm install --frozen-lockfile
else
    echo "📥 Installing pnpm dependencies (no lockfile)..."
    pnpm install
fi

# =============================================================================
# DATABASE INITIALIZATION
# =============================================================================

echo "🗄️  Waiting for database to be ready..."

# Wait for PostgreSQL to be ready
max_attempts=30
attempt=0
until PGPASSWORD="${POSTGRES_PASSWORD:-valueos_dev}" psql -h localhost -p "${POSTGRES_PORT:-54323}" -U "${POSTGRES_USER:-valueos}" -d "${POSTGRES_DB:-valueos_dev}" -c "SELECT 1" > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo "❌ Database failed to start after $max_attempts attempts"
        exit 1
    fi
    echo "⏳ Waiting for database... (attempt $attempt/$max_attempts)"
    sleep 2
done

echo "✅ Database is ready"

# =============================================================================
# MIGRATION APPLICATION
# =============================================================================

echo "🚀 Applying database migrations..."

if [ -f infra/scripts/apply_migrations.sh ]; then
    bash infra/scripts/apply_migrations.sh
    echo "✅ Migrations applied successfully"
else
    echo "⚠️  Migration script not found, skipping"
fi

# =============================================================================
# AGENT FABRIC SETUP
# =============================================================================

if [ "${ENABLE_AGENT_FABRIC:-false}" = "true" ]; then
    echo "🤖 Setting up agent fabric..."
    
    # Wait for NATS to be ready
    max_attempts=30
    attempt=0
    until curl -f http://localhost:8222/healthz > /dev/null 2>&1; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            echo "⚠️  NATS failed to start, continuing anyway"
            break
        fi
        echo "⏳ Waiting for NATS... (attempt $attempt/$max_attempts)"
        sleep 2
    done
    
    echo "✅ Agent fabric ready"
fi

# =============================================================================
# DEVELOPMENT TOOLS
# =============================================================================

echo "🛠️  Setting up development tools..."

# Install global tools if needed
if ! command -v tsx &> /dev/null; then
    pnpm add -g tsx
fi

# Setup git hooks if using husky
if [ -d .husky ]; then
    echo "🪝 Setting up git hooks..."
    pnpm exec husky install
fi

# =============================================================================
# COMPLETION
# =============================================================================

echo ""
echo "✅ on-create setup completed successfully!"
echo ""
echo "📚 Next steps:"
echo "  1. Review .devcontainer/.env and update as needed"
echo "  2. Run 'pnpm dev' to start the development server"
echo "  3. Open http://localhost:3001 for the frontend"
echo "  4. Open http://localhost:54324 for Supabase Studio"
echo ""
