#!/bin/bash
set -e

# Idempotent Database Migrations Script
# Uses Supabase CLI in db-url mode to apply migrations to the local Postgres service

if [ -f "infra/supabase/config.toml" ]; then
    echo "Applying migrations to local Supabase instance..."
    supabase db push --db-url "postgresql://postgres:postgres@db:5432/postgres" --workdir infra/supabase
    echo "✅ Migrations applied successfully."
else
    echo "⚠️ Warning: infra/supabase/config.toml not found. Skipping migrations."
fi
