# Local Supabase Development - Issue & Alternative Workflow

## Problem Summary

Attempted to set up local Supabase development environment but encountered persistent database container startup failures:

```
failed to connect to postgres: failed to connect to `host=127.0.0.1 user=postgres database=postgres`:
dial error (dial tcp 127.0.0.1:54322: connect: connection refused)
```

### What Was Tried

1. ✅ Created `supabase/config.toml` with proper configuration
2. ✅ Ran `npx supabase init` successfully
3. ❌ PostgreSQL container fails to start despite:
   - Trying PostgreSQL versions 15 and 17
   - Removing remote project linking
   - Cleaning Docker volumes and networks
   - Testing with minimal service exclusions
   - Multiple clean restarts

### Root Cause (Suspected)

The issue appears to be related to the dev container environment and Docker-in-Docker networking. The PostgreSQL container starts but fails health checks before the CLI can connect.

---

## Alternative Development Workflows

Since the local Supabase instance won't start, here are safer development approaches:

### **Option 1: Create a Dedicated Dev/Staging Project** ⭐ **RECOMMENDED**

Create a separate Supabase project specifically for development:

1. **Create new Supabase project** at https://supabase.com/dashboard
   - Name it: `ValueOS-Development` or `ValueOS-Staging`
   - Copy the project URL and anon key

2. **Update `.env.local` for dev project:**

   ```bash
   VITE_SUPABASE_URL=https://your-dev-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-dev-anon-key
   ```

3. **Link the dev project:**

   ```bash
   npx supabase link --project-ref your-dev-project-ref
   ```

4. **Push migrations to dev:**
   ```bash
   npx supabase db push
   ```

**Benefits:**

- ✅ Safe experimentation without risking production
- ✅ Reset anytime via Supabase dashboard
- ✅ Full feature parity with production
- ✅ Test migrations before deploying to production

---

### **Option 2: Git-Based Migration Testing**

Use Git branching to safely develop and test migrations:

1. **Always create a feature branch:**

   ```bash
   git checkout -b feature/new-migration
   ```

2. **Create migration locally:**

   ```bash
   npx supabase migration new my_feature
   # Edit the SQL file
   ```

3. **Test on remote (use with caution):**

   ```bash
   # Create a backup first!
   npx supabase db dump > backup-$(date +%Y%m%d).sql

   # Push migration
   npx supabase db push

   # If something breaks, you can revert
   ```

4. **Use migration repair if needed:**
   ```bash
   npx supabase migration repair --status reverted <migration-id>
   ```

**Benefits:**

- ✅ Version control for all database changes
- ✅ Easy rollback via Git
- ✅ Code review for migrations

---

### **Option 3: Manual SQL Testing**

For quick schema experiments:

1. **Access Supabase Studio** at https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Test SQL statements manually
4. Once validated, create proper migration file:
   ```bash
   npx supabase migration new implement_feature
   # Copy validated SQL into new migration
   ```

**Benefits:**

- ✅ Instant feedback
- ✅ Visual query results
- ✅ Easy to experiment

---

## Recommended Setup for Your Workflow

### 1. Create Environment Files

**`.env.local.development`** (for your dev/staging project):

```bash
# Development Supabase Project
VITE_SUPABASE_URL=https://your-dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-dev-anon-key
```

**`.env.local.production`** (backup of current):

```bash
# Production Supabase Project (your current bxaiabnqalurloblfwua)
VITE_SUPABASE_URL=https://bxaiabnqalurloblfwua.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Use Existing Environment Scripts

ValueOS already ships environment helpers. Use the canonical env compiler plus the staging/production helpers:

```bash
# Local env files (Supabase keys + ports)
pnpm run dx:env -- --mode local --force

# Switch to production env (uses deploy/envs/.env.production)
pnpm run env:production

# Safe push helper with built-in delay
pnpm run db:push:prod
```

### 3. Migration Development Flow

```bash
# 1. Switch to dev environment
pnpm run dx:env -- --mode local --force

# 2. Create feature branch
git checkout -b feature/my-feature

# 3. Create migration
npx supabase migration new my_feature_name

# 4. Edit migration file
# Edit supabase/migrations/XXXXXX_my_feature_name.sql

# 5. Push to dev
npx supabase db push

# 6. Test your app
pnpm run dev

#  7. When ready for production
git checkout main
pnpm run env:production
pnpm run db:push:prod
```

---

## Next Steps

1. **Decide on approach**:
   - **Recommended**: Create a dedicated dev/staging Supabase project
   - **Alternative**: Use careful Git workflow with current project

2. **If creating dev project**:
   - Create new project at supabase.com
   - Update environment files
   - Link and push all migrations

3. **Add safety scripts** from above to `package.json`

4. **Document your chosen workflow** for the team

---

##Troubleshooting Local Supabase (Future Reference)

If you want to retry local Supabase later:

1. **Check Docker memory**: Supabase needs ~1GB RAM

   ```bash
   docker info | grep -i memory
   ```

2. **Try on host machine** (outside devcontainer):
   - Clone repo to local machine
   - Run `supabase start` directly
   - May work better without Docker-in-Docker

3. **Alternative local tools**:
   - Use PostgreSQL directly with Docker Compose
   - Use Prisma with local PostgreSQL
   - Consider other local development stacks

---

## Files Created

- ✅ `supabase/config.toml` - Supabase configuration (ready for when local works)
- ✅ This documentation

## Files to Create

- [ ] `.env.local.development` - Dev environment variables
- [ ] `.env.local.production` - Production environment variables (backup)
- [ ] Package.json script updates
