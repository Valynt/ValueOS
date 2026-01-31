#!/bin/bash
set -e

echo "🚀 Starting ValueOS Post-Create Setup..."

# R4: Marker-gated install
if [ -f ".deps_installed" ]; then
    echo "✅ Dependencies already installed. Skipping pnpm install."
else
    echo "📦 Installing dependencies..."
    pnpm install
    mkdir -p .deps_installed
    touch .deps_installed
fi

# R2: Wait for Supabase DB
echo "⏳ Waiting for Supabase DB to be ready..."
until PGPASSWORD=postgres psql -h db -U postgres -c '\q'; do
  echo "   ...waiting for db:5432"
  sleep 2
done
echo "✅ DB is ready."

# Deliverable C: Idempotent Migrations
echo "🔄 Applying Database Migrations..."
bash scripts/dev/migrate.sh

echo "🎉 Development environment ready!"
echo "   - App: http://localhost:5173"
echo "   - Studio: http://localhost:54323"
echo "   - API: http://localhost:54321"
