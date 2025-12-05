# Supabase Best Practices for ValueCanvas

This document outlines the production-ready practices we follow for Supabase development.

---

## 📁 Directory Organization

```
supabase/
├── migrations/          # ✅ The Truth - Never edit after applied
├── functions/           # ✅ Edge Functions (Deno)
│   ├── _shared/         # ✅ Shared utilities (not deployed)
│   └── import_map.json  # ✅ Centralized dependency management
├── rollbacks/           # ✅ Rollback scripts for each migration
├── tests/               # ✅ Database tests (pgTAP)
├── seed.sql             # ✅ Auto-runs on db reset
└── config.toml          # ✅ Local development only
```

---

## 1️⃣ Migrations (The Truth)

### **Golden Rules**

✅ **DO:**
- Keep migrations small and atomic
- Use `supabase migration new <name>` to create
- Use `supabase db diff` to generate from UI changes
- Test locally before pushing
- Create rollback script for each migration
- Add verification checks at end of migration

❌ **DON'T:**
- Never edit migrations after they're applied
- Don't bundle 3 months of work into one file
- Don't commit schema dumps
- Don't skip rollback scripts

### **Workflow**

```bash
# 1. Create new migration
npm run db:migration new add_feature_name

# 2. Edit the generated file
supabase/migrations/20241201_add_feature_name.sql

# 3. Test locally
npm run db:reset

# 4. Create rollback
# Add to supabase/rollbacks/

# 5. Push to remote
npm run db:push
```

---

## 2️⃣ Edge Functions

### **Shared Code Pattern**

```typescript
// functions/_shared/cors.ts
export const corsHeaders = { /* ... */ };

// functions/my-function/index.ts
import { corsHeaders } from 'cors';  // Uses import_map.json

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  // ...
});
```

### **import_map.json**

Centralize all dependencies:

```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.39.3",
    "cors": "../_shared/cors.ts",
    "database": "../_shared/database.ts"
  }
}
```

**Benefits:**
- Update version once, affects all functions
- No need for individual `deno.json` files
- Consistent package versions

---

## 3️⃣ Seed Data

### **Purpose**

`seed.sql` runs automatically on `supabase db reset` to populate local database with test data.

### **What to Include**

```sql
-- ✅ Good: Default roles, feature flags, test users
INSERT INTO roles (role_name) VALUES ('admin'), ('user');

-- ❌ Bad: Production data, secrets, PII
INSERT INTO users (email, password) VALUES ('real@user.com', 'password123');
```

### **Pro Tip: Split Large Seeds**

```sql
-- seed.sql (master file)
\ir seeds/roles.sql
\ir seeds/test_users.sql
\ir seeds/feature_flags.sql
```

---

## 4️⃣ Database Tests

### **pgTAP Framework**

```sql
-- tests/database/rls_policies.test.sql
BEGIN;
SELECT plan(5);

-- Test 1: RLS is enabled
SELECT results_eq(
  $$ SELECT tablename FROM pg_tables WHERE rowsecurity = true $$,
  $$ VALUES ('cases'), ('workflows'), ('messages') $$,
  'RLS should be enabled'
);

SELECT * FROM finish();
ROLLBACK;
```

### **Run Tests**

```bash
# Run all database tests
npm run db:test

# Run validation
npm run db:validate
```

---

## 5️⃣ Type Generation

### **Keep Types in Sync**

```bash
# Generate types from local database
npm run db:types

# Generate types from linked remote
npm run db:types:remote
```

### **Usage in Frontend**

```typescript
// src/types/supabase.ts (auto-generated)
import { Database } from './types/supabase';

type Case = Database['public']['Tables']['cases']['Row'];
type CaseInsert = Database['public']['Tables']['cases']['Insert'];
```

---

## 6️⃣ CI/CD Integration

### **Automated Deployment**

Our GitHub Actions workflow:

1. **Validate** - Run tests on every PR
2. **Deploy to Staging** - Auto-deploy PRs
3. **Deploy to Production** - Auto-deploy on merge to main
4. **Rollback** - Manual workflow trigger

```bash
# Triggered by:
- push to main (production)
- PR to main (staging)
- Changes to supabase/** only
```

### **Required Secrets**

Set in GitHub Settings → Secrets:

```
SUPABASE_ACCESS_TOKEN
SUPABASE_STAGING_PROJECT_REF
SUPABASE_PRODUCTION_PROJECT_REF
SUPABASE_STAGING_DB_PASSWORD
SUPABASE_PRODUCTION_DB_PASSWORD
```

---

## 7️⃣ Security Best Practices

### **Environment Variables**

```bash
# ❌ Never commit .env
.env
.env.local

# ✅ Use env() in config.toml
secret = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"
```

### **Service Role Key**

```typescript
// ❌ Never expose service role key to frontend
const supabase = createClient(url, SERVICE_ROLE_KEY);

// ✅ Only use in backend/edge functions
const supabase = createServiceClient();  // In Edge Function
```

### **RLS Policies**

```sql
-- ✅ Always use RLS
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_cases"
  ON cases FOR ALL
  USING (auth.uid() = user_id);

-- ❌ Never use USING (true) for authenticated users
CREATE POLICY "anyone_can_do_anything"
  ON cases FOR ALL
  USING (true);  -- DANGER!
```

---

## 8️⃣ Common Workflows

### **Adding a New Table**

```bash
# 1. Create migration
npm run db:migration new add_products_table

# 2. Edit migration
# - CREATE TABLE
# - Add RLS policies
# - Add indexes
# - Add verification

# 3. Create rollback
# supabase/rollbacks/YYYYMMDD_rollback_products.sql

# 4. Test locally
npm run db:reset
npm run db:test

# 5. Generate types
npm run db:types

# 6. Push
npm run db:push
```

### **Updating RLS Policies**

```bash
# 1. Create migration for policy changes
npm run db:migration new update_cases_policies

# 2. Edit migration
# - DROP old policies
# - CREATE new policies

# 3. Test with pgTAP
# Add test to tests/database/rls_policies.test.sql

# 4. Deploy
npm run db:push
```

### **Deploying Edge Function**

```bash
# 1. Create function
mkdir supabase/functions/my-function
touch supabase/functions/my-function/index.ts

# 2. Use shared utilities
import { corsResponse } from 'cors';
import { createAuthClient } from 'database';

# 3. Test locally
supabase functions serve my-function

# 4. Deploy
supabase functions deploy my-function
```

---

## 9️⃣ Troubleshooting

### **Migration Fails**

```bash
# Check migration status
supabase migration list

# View error details
npm run db:push --debug

# Rollback if needed
psql $DB_URL -f supabase/rollbacks/YYYYMMDD_rollback.sql
```

### **Edge Function Error**

```bash
# View logs
supabase functions logs my-function --tail

# Test locally
supabase functions serve my-function
curl http://localhost:54321/functions/v1/my-function
```

### **Types Out of Sync**

```bash
# Regenerate types
npm run db:types

# Or from remote
npm run db:types:remote
```

---

## 🔟 Code Review Checklist

Before merging PRs with Supabase changes:

- [ ] Migration has rollback script
- [ ] Tests added for new functionality
- [ ] RLS policies tested
- [ ] Types regenerated (`npm run db:types`)
- [ ] Tested locally with `db:reset`
- [ ] No secrets committed
- [ ] Edge functions use shared utilities
- [ ] CI/CD pipeline passes

---

## 📚 Additional Resources

- **Main README:** `supabase/README.md`
- **Configuration:** `supabase/CONFIG_GUIDE.md`
- **Validation Report:** `docs/migrations/COMPLETE_VALIDATION_REPORT.md`
- **Rollback Guide:** `docs/migrations/ROLLBACK_GUIDE.md`

---

**Last Updated:** December 1, 2025  
**Maintainer:** ValueCanvas Team
