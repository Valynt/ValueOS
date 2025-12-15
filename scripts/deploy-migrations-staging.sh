#!/bin/bash
set -e

# Deploy DB Migrations to Staging
# 
# Deploys new migrations to staging environment with safety checks

echo "🚀 Deploying DB migrations to staging..."

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install with: npm install -g supabase"
    exit 1
fi

# Check if we're linked to a project
if [ ! -f ".supabase/config.toml" ]; then
    echo "❌ Not linked to a Supabase project. Run: supabase link"
    exit 1
fi

# Get current migration status
echo "📊 Checking current migration status..."
supabase migration list --db-url "$STAGING_DATABASE_URL" || true

# New migrations to deploy
NEW_MIGRATIONS=(
    "20251214000000_add_confidence_calibration.sql"
    "20260111000000_add_memory_gc_and_provenance.sql"
    "20260111000000_add_tenant_isolation_to_match_memory.sql"
    "20260112000000_add_org_filter_to_search_semantic_memory.sql"
    "20260113000000_create_memory_provenance.sql"
    "20260114000000_add_org_to_semantic_memory.sql"
)

echo ""
echo "📋 New migrations to deploy:"
for migration in "${NEW_MIGRATIONS[@]}"; do
    echo "  - $migration"
done

# Confirm deployment
read -p "Deploy these migrations to staging? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Deploy migrations
echo ""
echo "🔄 Deploying migrations..."
supabase db push --db-url "$STAGING_DATABASE_URL"

# Verify deployment
echo ""
echo "✅ Verifying deployment..."
supabase migration list --db-url "$STAGING_DATABASE_URL"

# Run post-deployment checks
echo ""
echo "🔍 Running post-deployment checks..."

# Check if confidence calibration tables exist
psql "$STAGING_DATABASE_URL" -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'agent_calibration%';" || true

# Check if memory GC function exists
psql "$STAGING_DATABASE_URL" -c "SELECT proname FROM pg_proc WHERE proname = 'cleanup_old_memories';" || true

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Run canary token red-team tests"
echo "  2. Monitor staging for 24 hours"
echo "  3. Deploy to production if stable"
