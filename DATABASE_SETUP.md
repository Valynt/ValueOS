# Database Setup Guide

## Quick Setup (Recommended)

```bash
# 1. Set environment variables
export SUPABASE_PROJECT_ID=bxaiabnqalurloblfwua
export SUPABASE_DB_PASSWORD=your-password-here

# 2. Run the complete setup script
npm run db:setup
```

## Manual Setup

### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 2: Link to Your Project

```bash
# Using npm script
npm run db:link

# Or manually
supabase link --project-ref bxaiabnqalurloblfwua
```

### Step 3: Push Migrations

```bash
# Using npm script (recommended)
npm run db:push

# Or manually
supabase db push
```

## What Gets Set Up

The setup script will:

1. ✅ Link to your Supabase project (`bxaiabnqalurloblfwua`)
2. ✅ Apply all 48 migrations from `supabase/migrations/`
3. ✅ Enable Row Level Security (RLS) on all tables
4. ✅ Set up service roles
5. ✅ Generate TypeScript types
6. ✅ Verify database connection

## Database Tables

After setup, you'll have these tables:

### Core Tables
- `workflow_sessions` - Workflow session management
- `workflow_state` - State tracking
- `agent_predictions` - Agent prediction history
- `agent_fabric` - Agent configuration

### Monitoring & Analytics
- `llm_monitoring` - LLM API call tracking
- `llm_job_results` - Job results
- `semantic_memory` - Agent memory
- `episodic_memory` - Historical events

### Business Intelligence
- `business_metrics` - KPIs and metrics
- `feature_flags` - Feature toggles
- `audit_logs` - Security audit trail

### SOF (Systemic Outcome Framework)
- `sof_systems` - System definitions
- `sof_boundaries` - System boundaries
- `sof_interventions` - Intervention tracking
- `sof_outcomes` - Outcome measurements

### Compliance & Security
- `data_classification` - Data classification
- `retention_policies` - Data retention
- `secret_audit_logs` - Secret access logs

And many more...

## Troubleshooting

### "Supabase CLI not found"

```bash
npm install -g supabase
```

### "Project not linked"

```bash
npm run db:link
```

### "Authentication failed"

Make sure you're logged in:

```bash
supabase login
```

### "Migration failed"

Check for syntax errors in migration files:

```bash
# View recent migrations
ls -lt supabase/migrations/ | head -10

# Check specific migration
cat supabase/migrations/filename.sql
```

### "RLS errors"

Row Level Security is automatically enabled. If you need to disable temporarily for testing:

```sql
-- In Supabase SQL Editor
ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;
```

## Verify Setup

Check your database is set up correctly:

```bash
# View tables in Supabase Dashboard
# https://supabase.com/dashboard/project/bxaiabnqalurloblfwua

# Or via CLI
supabase db execute --sql "
SELECT 
  schemaname,
  tablename 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

## Environment Variables

Your `.env.local` should have:

```bash
VITE_SUPABASE_URL=https://bxaiabnqalurloblfwua.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_27wlTKSOPHD4d230CqJ_fQ_TISpmO8-
```

## Next Steps

After database setup:

1. ✅ Run tests: `npm test`
2. ✅ Start dev server: `npm run dev`
3. ✅ Try signing up at http://localhost:5173

## Useful Commands

```bash
# Database management
npm run db:setup      # Complete setup (includes link + push)
npm run db:push       # Apply pending migrations
npm run db:link       # Link to Supabase project

# Testing
npm test              # Run all tests
npm run test:watch    # Watch mode

# Development
npm run dev           # Start dev server
```

## Support

- **Supabase Docs:** https://supabase.com/docs
- **Project Dashboard:** https://supabase.com/dashboard/project/bxaiabnqalurloblfwua
- **Migration Guide:** `/supabase/migrations/ROLLBACK_GUIDE.md`
