# Supabase Environment Setup Guide

## Quick Reference

### Environment Files

- **`.env.production`** - Production credentials (current bxaiabnqalurloblfwua project)
- **`.env.staging`** - Staging credentials (to be configured)
- **`.env.local`** - Active environment (gitignored)

### Package Scripts

**Environment Switching:**

```bash
pnpm run env:status          # Show current environment
pnpm run env:staging         # Switch to staging
pnpm run env:production      # Switch to production
```

**Development:**

```bash
pnpm run dev:staging         # Start dev server with staging
pnpm run dev:production      # Start dev server with production
```

**Database Operations:**

```bash
pnpm run db:backup:manual    # Create timestamped backup
pnpm run db:push:staging     # Push migrations to staging
pnpm run db:push:prod        # Push to production (5s delay)
```

---

## Initial Setup (One-Time)

### Step 1: Create Staging Project

1. Visit https://supabase.com/dashboard
2. Click **"New Project"**
3. Configure:
   - **Name:** `ValueOS-Staging` or `ValueOS-Dev`
   - **Organization:** Your organization
   - **Database Password:** Generate strong password (save securely)
   - **Region:** Same as production for consistency
   - **Plan:** Free tier
4. Click **"Create new project"**
5. Wait ~2 minutes for provisioning

### Step 2: Get Staging Credentials

1. From staging project dashboard
2. Go to **Settings** → **API**
3. Copy these values:
   - **Project URL** (e.g., `https://abc123xyz.supabase.co`)
   - **Project API keys** → **anon/public** key (long JWT string)
   - **Project Settings** → **General** → **Reference ID** (e.g., `abc123xyz`)

### Step 3: Configure .env.staging

Edit `.env.staging` and replace placeholders:

```bash
# Replace these lines:
VITE_SUPABASE_URL=https://YOUR-STAGING-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-STAGING-ANON-KEY-HERE

# With your actual staging credentials:
VITE_SUPABASE_URL=https://abc123xyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...actual-key-here
```

### Step 4: Link CLI to Staging

```bash
# Switch to staging environment
pnpm run env:staging

# Link Supabase CLI
npx supabase link --project-ref <your-staging-ref>
# Example: npx supabase link --project-ref abc123xyz
```

### Step 5: Push Migrations to Staging

```bash
# Push all 5 existing migrations
pnpm run db:push:staging
```

You should see:

```
✅ Switched to STAGING environment
Do you want to push these migrations to the remote database?
 • 20241227000000_squashed_schema.sql
 • 20241229000000_hitl_tables.sql
 • 20241229115900_organizations_tables.sql
 • 20241229120000_integration_tables.sql
 • 20241229150000_security_audit_events.sql
```

Type `Y` to confirm.

### Step 6: Verify Setup

```bash
# Check current environment
pnpm run env:status
# Should show: Current environment: https://abc123xyz.supabase.co

# Start dev server
pnpm run dev:staging

# Visit http://localhost:5173
# App should connect to staging database
```

---

## Daily Development Workflow

### Start Your Day

```bash
# Verify you're on staging
pnpm run env:status

# If not, switch
pnpm run env:staging

# Start development
pnpm run dev
```

### Creating Migrations

```bash
# Ensure on staging
pnpm run env:staging

# Create migration
npx supabase migration new my_feature_name

# Edit the generated SQL file
# supabase/migrations/YYYYMMDDHHMMSS_my_feature_name.sql

# Test on staging
pnpm run db:push:staging

# If there's an issue, rollback
npx supabase migration repair --status reverted <migration-id>
```

### Before Deploying to Production

```bash
# 1. Create backup of production
pnpm run env:production
pnpm run db:backup:manual

# 2. Review what will be deployed
npx supabase migration list

# 3. Switch back to staging to test one more time
pnpm run env:staging
pnpm run dev
# Manually test your changes

# 4. Deploy to production (has 5-second safety delay)
pnpm run db:push:prod
```

---

## Troubleshooting

### "Which environment am I using?"

```bash
pnpm run env:status
```

### "I pushed to the wrong environment!"

```bash
# If you have a backup:
pnpm run env:production  # or env:staging
npx supabase db dump > restore.sql
# Contact admin for help with restore

# Rollback migration:
npx supabase migration repair --status reverted <migration-id>
```

### "My .env.local disappeared"

```bash
# Restore from backup
cp backups/.env.local.backup.YYYYMMDD .env.local

# Or recreate:
pnpm run env:staging  # for daily dev
```

### "Migrations won't push"

```bash
# Check migrations are in sync
npx supabase migration list

# If out of sync, see repair command in implementation plan
```

---

## Safety Features

✅ **5-Second Delay** - `pnpm run db:push:prod` has built-in delay  
✅ **Environment Labels** - Clear SUCCESS/WARNING emoji indicators  
✅ **Backup Scripts** - Easy timestamped backups  
✅ **Environment Status** - Always know which DB you're connected to  
✅ **Separate Files** - Production credentials isolated from staging

---

## File Summary

| File              | Purpose                | Commit to Git? |
| ----------------- | ---------------------- | -------------- |
| `.env.production` | Production credentials | ❌ No          |
| `.env.staging`    | Staging credentials    | ❌ No          |
| `.env.local`      | Active environment     | ❌ No          |
| `.env.example`    | Template for team      | ✅ Yes         |
| `package.json`    | Environment scripts    | ✅ Yes         |

---

## Next Steps

1. **Create staging project** (Steps 1-2 above)
2. **Configure credentials** (Step 3)
3. **Link and push** (Steps 4-5)
4. **Start developing** on staging!

Questions? See the full implementation plan for details.
