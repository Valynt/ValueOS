#!/bin/bash
set -euo pipefail

# 02-create-migrations-table.sh
# Creates the schema_migrations table for tracking applied migrations
# This is the foundation for the migration pipeline

echo "📋 Creating schema migrations tracking table..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create schema_migrations table
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        checksum TEXT,
        execution_time_ms INTEGER,
        applied_by TEXT DEFAULT CURRENT_USER
    );

    -- Create index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
        ON public.schema_migrations(applied_at DESC);

    -- Grant permissions
    GRANT SELECT ON public.schema_migrations TO anon, authenticated;
    GRANT ALL ON public.schema_migrations TO service_role, supabase_admin;

    -- Add comment
    COMMENT ON TABLE public.schema_migrations IS 
        'Tracks all applied database migrations with metadata for auditing and rollback';

    -- Create migration_history table for detailed logging
    CREATE TABLE IF NOT EXISTS public.migration_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        migration_name TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('apply', 'rollback', 'verify')),
        status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'pending')),
        error_message TEXT,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE,
        applied_by TEXT DEFAULT CURRENT_USER,
        metadata JSONB DEFAULT '{}'::jsonb
    );

    -- Create index for migration history
    CREATE INDEX IF NOT EXISTS idx_migration_history_name 
        ON public.migration_history(migration_name);
    CREATE INDEX IF NOT EXISTS idx_migration_history_started_at 
        ON public.migration_history(started_at DESC);

    -- Grant permissions
    GRANT SELECT ON public.migration_history TO authenticated;
    GRANT ALL ON public.migration_history TO service_role, supabase_admin;

    -- Add comment
    COMMENT ON TABLE public.migration_history IS 
        'Detailed audit log of all migration operations for compliance and debugging';
EOSQL

echo "✅ Schema migrations tracking tables created successfully"
