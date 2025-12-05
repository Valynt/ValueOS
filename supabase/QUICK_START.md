# ValueCanvas Supabase Quick Start

**Post-Consolidation Guide** - Updated December 1, 2025

---

## ⚡ TL;DR

```bash
# Start Supabase
supabase start

# Reset database (applies baseline + seed)
supabase db reset

# Generate TypeScript types
npm run db:types

# You're ready to code! 🚀
```

---

## 🎯 What Changed

### Before Consolidation
- 52 migration files
- Complex dependency chain
- ~30 second reset time
- Unused features included

### After Consolidation
- **1 baseline migration** (`20250101000000_baseline_schema.sql`)
- Zero dependencies
- ~3 second reset time
- Only shipped features included

---

## 📋 What's Included

### Core Tables (18)

**User Management:**
- `users`, `organizations`, `teams`
- `roles`, `organization_members`, `team_members`

**Application:**
- `cases`, `workflows`, `messages`

**Agent Fabric:**
- `agents`, `agent_sessions`
- `episodic_memory`, `agent_memory`
- `agent_predictions`

**Monitoring:**
- `llm_usage`, `feature_flags`

**Audit:**
- `audit_logs`, `security_audit_log`, `agent_audit_log`

### Security Features

✅ **Row Level Security (RLS)** on all 18 tables  
✅ **Immutable audit logs** (cannot UPDATE/DELETE)  
✅ **User-scoped access** for all data  
✅ **Service role bypass** for backend operations

### Performance

✅ **40+ indexes** on foreign keys and frequent queries  
✅ **Vector search** (pgvector) for semantic memory  
✅ **Optimized RLS policies** with composite indexes

---

## 🚀 Common Tasks

### Reset Database
```bash
# Drops everything and recreates from baseline + seed
supabase db reset
```

### Generate Types
```bash
# TypeScript types from schema
npm run db:types

# Creates: src/types/supabase.ts
```

### Run Tests
```bash
# pgTAP test suite
npm run db:test
```

### Create New Migration
```bash
# Only do this AFTER baseline is deployed to production
supabase migration new add_new_feature

# Edit the file
vim supabase/migrations/YYYYMMDD_add_new_feature.sql

# Test it
supabase db reset
```

### Deploy to Production
```bash
# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Or use CI/CD (GitHub Actions workflow included)
git push origin main
```

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| `README.md` | Complete overview |
| `BEST_PRACTICES.md` | Development workflows |
| `CONFIG_GUIDE.md` | Configuration reference |
| `CONSOLIDATION_SUMMARY.md` | What changed & why |
| `migrations/BASELINE_MIGRATION_NOTES.md` | Schema details |

---

## 🧪 Verify Installation

After `supabase db reset`, check:

```bash
# Should have 18 tables
psql $DATABASE_URL -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"

# Should have RLS enabled on all 18
psql $DATABASE_URL -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;"

# Should have 4 roles
psql $DATABASE_URL -c "SELECT count(*) FROM roles;"

# Should have 4 feature flags
psql $DATABASE_URL -c "SELECT count(*) FROM feature_flags;"
```

Expected output:
```
count: 18  (tables)
count: 18  (rls enabled)
count: 4   (roles)
count: 4   (feature flags)
```

---

## 🔒 Security Verification

Test audit log immutability:

```sql
-- This should FAIL with error
UPDATE audit_logs SET action = 'test' WHERE id = (SELECT id FROM audit_logs LIMIT 1);
-- Expected: ERROR: Audit logs are immutable and cannot be modified or deleted
```

Test RLS:

```sql
-- As authenticated user, can only see own data
SELECT * FROM cases WHERE user_id = auth.uid();

-- Service role bypasses RLS
SET ROLE service_role;
SELECT * FROM cases; -- sees all
```

---

## 🗂️ Directory Structure

```
supabase/
├── 📄 config.toml                           # Local config
├── 📄 seed.sql                              # Seed data
├── 📁 migrations/
│   ├── 20250101000000_baseline_schema.sql   ⭐ THE migration
│   ├── BASELINE_MIGRATION_NOTES.md
│   └── _archived/                           # Old files (reference)
├── 📁 rollbacks/
│   ├── README.md                            # Rollback strategy
│   └── _archived/
├── 📁 functions/
│   ├── _shared/                             # Shared utilities
│   ├── import_map.json
│   └── deno.json
└── 📁 tests/database/                       # pgTAP tests
```

---

## 🛠️ Troubleshooting

### "Supabase is not running"
```bash
supabase start
# Wait for services to initialize (~30 seconds)
```

### "Migration failed"
```bash
# Check logs
supabase db reset --debug

# Verify SQL syntax
cat supabase/migrations/20250101000000_baseline_schema.sql | psql $DB
```

### "Types not generated"
```bash
# Create directory first
mkdir -p src/types

# Then generate
npm run db:types
```

### "Tests failing"
```bash
# Reset first
supabase db reset

# Then test
npm run db:test

# Or run specific test
psql $DB -f supabase/tests/database/rls_policies.test.sql
```

---

## 📞 Getting Help

1. Check documentation in `supabase/*.md`
2. Review archived migrations in `migrations/_archived/`
3. Check Supabase docs: https://supabase.com/docs
4. Review baseline notes: `migrations/BASELINE_MIGRATION_NOTES.md`

---

## ✅ Checklist for New Developers

- [ ] Install Supabase CLI: `npm install -g supabase`
- [ ] Run `supabase start`
- [ ] Run `supabase db reset`
- [ ] Verify 18 tables created
- [ ] Run `npm run db:types`
- [ ] Run `npm run db:test` (all pass)
- [ ] Read `BEST_PRACTICES.md`
- [ ] Start coding! 🎉

---

**You now have a clean, production-ready Supabase setup with zero technical debt!**
