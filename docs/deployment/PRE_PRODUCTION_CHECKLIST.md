# Pre-Production Deployment Checklist

**Last Updated:** 2025-12-10  
**Status:** Critical Pre-Production Actions Required  
**Target:** Production Deployment of ValueCanvas Multi-Tenant Platform

---

## Executive Summary

This checklist ensures all critical security, configuration, and monitoring requirements are met before production deployment. Each item must be verified and signed off by the appropriate team member.

**Priority Levels:**
- 🔴 **CRITICAL** - Deployment blocker, must be completed
- 🟡 **HIGH** - Required for compliance/security, complete before launch
- 🟢 **RECOMMENDED** - Best practice, complete within first week

---

## 0. Staging Database Reset

### 🔴 CRITICAL: Reset to Clean Slate Before Production

**Objective:** Reset staging database to clean state while preserving Supabase system schemas.

**Supabase Official Recommendation:**
This follows Supabase's recommended reset strategy for projects that haven't gone live yet. It's faster and safer than selective deletion.

**What Gets Preserved:**
- ✅ **Supabase System Schemas:** `auth`, `storage`, `realtime`, `graphql`, `graphql_public`, `vault`, `extensions`, `supabase_migrations`
- ✅ **Extensions:** `vector`, `uuid-ossp`, `pgcrypto`, `pg_stat_statements`
- ✅ **System Infrastructure:** Authentication, storage buckets (files deleted separately), realtime subscriptions

**What Gets Reset:**
- 🔄 **User Schemas:** `public`, `internal`, `audit`, `security` - ALL objects dropped
- ❌ **All Tables:** Including test organizations, users, workflows, billing data
- ❌ **All Functions:** RLS helpers, custom functions, triggers
- ❌ **All Views:** Monitoring views, materialized views
- ❌ **All Types:** Enums, custom types
- ❌ **All Sequences:** Auto-increment sequences

**Advantages Over Selective Cleanup:**
- Guaranteed clean slate (no orphaned data)
- Faster execution (drops entire schemas)
- Migrations rebuild everything correctly
- No risk of missing dependent objects

#### 0.1 Backup Before Reset

**CRITICAL:** Always backup before destructive operations.

```bash
# Option 1: Supabase CLI (recommended)
supabase db dump -f backup-pre-reset-$(date +%Y%m%d-%H%M%S).sql

# Option 2: Direct pg_dump
pg_dump $DATABASE_URL > backup-pre-reset-$(date +%Y%m%d-%H%M%S).sql

# Verify backup exists and has content
ls -lh backup-pre-reset-*.sql

# Store backup securely (optional)
aws s3 cp backup-pre-reset-*.sql s3://your-backup-bucket/staging/
# OR
# Upload to Google Drive, Dropbox, etc.
```

**Expected:** Backup file should be 1MB+ (depending on data volume)

#### 0.2 Run Supabase Reset Script

```bash
# Review the reset script first (recommended)
cat scripts/reset-staging-database.sql

# Run reset (STAGING ONLY - includes safety checks)
psql $DATABASE_URL -f scripts/reset-staging-database.sql
```

**Expected Output:**
```
==========================================
Supabase Staging Database Reset
WARNING: This will drop ALL user objects
==========================================

0. Running safety checks...
  ✅ Database: your-staging-db (safe to reset)

1. Backup verification...
  ⚠️  CRITICAL: Ensure you have a backup before proceeding

2. Analyzing current database state...
  Current user schemas and object counts:
    Schema: public - 23 tables
    Schema: audit - 2 tables
    Schema: security - 3 tables
  Total user objects to drop: 28

3. Dropping all user objects...
  Processing schema: public
    ✅ Cleaned schema: public
  Processing schema: internal
    ✅ Cleaned schema: internal
  Total objects dropped: 87

4. Recreating custom schemas...
  ✅ Schemas recreated with proper permissions

5. Reinstalling required extensions...
  ✅ Extensions installed:
    - vector (for semantic search)
    - uuid-ossp (for UUID generation)
    - pgcrypto (for encryption)

7. Verifying reset...
  ✅ SUCCESS: Database reset to clean slate
    - User tables: 0
    - User functions: 0

==========================================
Reset Complete - Next Steps
==========================================
```

#### 0.3 Re-apply Migrations and Security

After reset, the database is a clean slate. Re-run migrations to rebuild schema:

```bash
# Apply all migrations from scratch
supabase db push

# OR use migration files directly
psql $DATABASE_URL -f supabase/migrations/20231201000000_initial_schema.sql
psql $DATABASE_URL -f supabase/migrations/20231202000000_rls_policies.sql
# ... (apply in order)

# Apply security hardening configuration
psql $DATABASE_URL -f docs/database/enterprise_saas_hardened_config_v2.sql
```

**Expected:** All tables, functions, RLS policies, triggers recreated

#### 0.4 Delete Storage Files (Manual)

The reset script **does not** delete files in Supabase Storage. Must do manually:

**Option 1: Supabase CLI (Recommended)**
```bash
# List all buckets
supabase storage list

# Delete files from each bucket (replace <bucket-name>)
supabase storage rm documents --recursive
supabase storage rm avatars --recursive
supabase storage rm workflows --recursive

# Verify buckets are empty
supabase storage list documents
# Expected: (empty)
```

**Option 2: SQL**
```sql
-- List all storage objects first
SELECT bucket_id, name, COUNT(*) as file_count
FROM storage.objects
GROUP BY bucket_id, name;

-- Delete all storage objects (STAGING ONLY)
DELETE FROM storage.objects
WHERE bucket_id IN ('avatars', 'documents', 'uploads');

-- Verify
SELECT bucket_id, COUNT(*) as remaining_files
FROM storage.objects
GROUP BY bucket_id;
-- Expected: 0 rows
```

#### 0.5 Verify Clean State

```sql
-- Check remaining data in user tables
SELECT schemaname, tablename, 
       (SELECT COUNT(*) FROM format('%I.%I', schemaname, tablename)::regclass) as row_count
FROM pg_tables
WHERE schemaname IN ('public', 'internal', 'audit', 'security')
  AND tablename NOT IN ('roles', 'feature_flags', 'billing_plans')
```sql
-- Check remaining data in user tables
SELECT schemaname, tablename, 
       (SELECT COUNT(*) FROM format('%I.%I', schemaname, tablename)::regclass) as row_count
FROM pg_tables
WHERE schemaname IN ('public', 'internal', 'audit', 'security')
  AND tablename NOT IN ('roles', 'feature_flags', 'billing_plans')
ORDER BY schemaname, tablename;
-- Expected: All tables exist but row_count = 0

-- Verify RLS policies are enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname IN ('public', 'internal')
  AND rowsecurity = false;
-- Expected: 0 rows (all tables have RLS enabled)

-- Verify extensions are installed
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('vector', 'uuid-ossp', 'pgcrypto', 'pg_stat_statements');
-- Expected: 4 rows showing all extensions

-- Verify storage is empty
SELECT bucket_id, COUNT(*) as file_count
FROM storage.objects
GROUP BY bucket_id;
-- Expected: 0 rows (no files in any bucket)
```

#### 0.6 Post-Reset Security Checklist

After reset and migrations, verify security configuration:

- [ ] **RLS enabled on all tables** (run: `SELECT * FROM security.verify_rls_enabled();`)
- [ ] **Audit tables are immutable** (triggers prevent UPDATE/DELETE)
- [ ] **Service role tracking active** (test: query `audit.service_role_operations`)
- [ ] **JWT secret is set** (`auth.jwt_secret` in Dashboard → Settings → API)
- [ ] **Storage policies applied** (test: upload file without auth = denied)
- [ ] **Edge Functions deployed with secrets** (test: call function, verify secrets loaded)

**Timeline:** 1 hour  
**Prerequisites:** Valid database backup, confirmed staging environment  
**Success Criteria:** 
- ✅ All user data deleted (tables exist but empty)
- ✅ Storage buckets empty
- ✅ Migrations re-applied successfully
- ✅ RLS policies active
- ✅ Extensions installed
- ✅ No test/development artifacts remain

---

## 1. JWT Custom Claims Configuration

### 🔴 CRITICAL: Configure organization_id in JWT Claims

**Objective:** Enable RLS policies to extract `organization_id` from JWT tokens for performance optimization.

**Current Implementation:**
```sql
-- Function attempts JWT extraction first (PRIORITY 1)
CREATE OR REPLACE FUNCTION security.get_user_organization_id()
RETURNS UUID AS $$
BEGIN
    -- Extract from JWT custom claims
    org_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'organization_id', '')::UUID;
    
    -- Fallback to users table lookup
    IF org_id IS NULL THEN
        SELECT organization_id INTO org_id FROM public.users WHERE id = auth.uid();
    END IF;
END;
$$;
```

**Action Items:**

#### 1.1 Configure Supabase Dashboard
1. Navigate to: **Supabase Dashboard** → **Authentication** → **Hooks** (or **Custom Claims**)
2. Add custom claim function:

```sql
-- Create function to populate JWT claims on sign-in
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_org_id uuid;
  user_role text;
BEGIN
  -- Fetch user's organization_id and role
  SELECT organization_id, role INTO user_org_id, user_role
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  -- Set custom claims
  claims := event->'claims';
  
  IF user_org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(user_org_id::text));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;

  -- Return modified event
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
```

3. Register the hook in Supabase:
   - Go to **Database** → **Webhooks** → **Enable custom access token hook**
   - Select function: `public.custom_access_token_hook`
   - Save configuration

#### 1.2 Verify JWT Claims
```bash
# Test JWT token contains organization_id
curl -X POST https://your-project.supabase.co/auth/v1/token \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'

# Decode JWT and verify claims include organization_id
echo "YOUR_JWT_TOKEN" | jwt decode -
```

Expected output:
```json
{
  "sub": "user-uuid",
  "organization_id": "org-uuid",
  "user_role": "member",
  "aud": "authenticated",
  "exp": 1234567890
}
```

#### 1.3 Performance Impact
- **Before:** Every RLS check requires database lookup (~5-10ms)
- **After:** JWT claim extraction (~0.1ms)
- **Expected Improvement:** 50-100x faster RLS enforcement

**Sign-off:** ☐ Backend Lead ☐ DevOps Engineer

---

## 2. Cross-Tenant Access Testing

### 🔴 CRITICAL: Test Multi-Tenant Isolation in Staging

**Objective:** Verify RLS policies prevent cross-tenant data access under all scenarios.

#### 2.1 Create Test Organizations
```sql
-- Create two test organizations
INSERT INTO public.organizations (id, name, slug, status) VALUES
  ('org-a-uuid', 'Test Org A', 'test-org-a', 'active'),
  ('org-b-uuid', 'Test Org B', 'test-org-b', 'active');

-- Create test users in each org
INSERT INTO public.users (id, organization_id, email, role, status) VALUES
  ('user-a-uuid', 'org-a-uuid', 'user-a@test.com', 'member', 'active'),
  ('user-b-uuid', 'org-b-uuid', 'user-b@test.com', 'member', 'active');
```

#### 2.2 Test Scenarios

**Test 1: User A Cannot Access Org B Data**
```sql
-- Authenticate as user-a@test.com
SET request.jwt.claims = '{"sub": "user-a-uuid", "organization_id": "org-a-uuid"}';

-- Attempt to read Org B's data (should return 0 rows)
SELECT * FROM public.organizations WHERE id = 'org-b-uuid';
-- Expected: 0 rows (RLS blocks access)

-- Attempt to read own org's data (should succeed)
SELECT * FROM public.organizations WHERE id = 'org-a-uuid';
-- Expected: 1 row
```

**Test 2: Direct Table Queries Fail Across Tenants**
```sql
-- Create test data in both orgs
INSERT INTO public.workflows (organization_id, name, status) VALUES
  ('org-a-uuid', 'Workflow A', 'active'),
  ('org-b-uuid', 'Workflow B', 'active');

-- User A should only see their workflow
SET request.jwt.claims = '{"sub": "user-a-uuid", "organization_id": "org-a-uuid"}';
SELECT count(*) FROM public.workflows;
-- Expected: 1 (only Workflow A)

-- User B should only see their workflow
SET request.jwt.claims = '{"sub": "user-b-uuid", "organization_id": "org-b-uuid"}';
SELECT count(*) FROM public.workflows;
-- Expected: 1 (only Workflow B)
```

**Test 3: Service Role Operations Are Audited**
```sql
-- Switch to service role
SET ROLE app_service;

-- Perform cross-tenant operation
UPDATE public.organizations 
SET name = 'Updated by Service' 
WHERE id = 'org-a-uuid';

-- Verify audit log captured the operation
SELECT * FROM audit.activity_log 
WHERE resource_type = 'organization' 
  AND resource_id = 'org-a-uuid'
  AND is_service_operation = true
ORDER BY timestamp DESC LIMIT 1;
-- Expected: 1 row with service_role tracked
```

**Test 4: Vector/Semantic Memory Isolation**
```sql
-- User A inserts semantic memory
SET request.jwt.claims = '{"sub": "user-a-uuid", "organization_id": "org-a-uuid"}';
INSERT INTO public.semantic_memory (organization_id, document_chunk, embedding) 
VALUES ('org-a-uuid', 'Test document', '[...]');

-- User B should NOT see User A's memory
SET request.jwt.claims = '{"sub": "user-b-uuid", "organization_id": "org-b-uuid"}';
SELECT count(*) FROM public.semantic_memory WHERE organization_id = 'org-a-uuid';
-- Expected: 0 rows
```

#### 2.3 Automated Test Script
```bash
# Run automated RLS tests
npm run test:rls

# Expected output:
# ✓ All tables have RLS enabled
# ✓ Cross-tenant access blocked (12/12 tests passed)
# ✓ Service role audit logging verified
```

**Sign-off:** ☐ Security Engineer ☐ QA Lead

---

## 3. Service Role Operation Monitoring

### 🟡 HIGH: Configure Alerts for Service Role Operations

**Objective:** Monitor and alert on cross-tenant operations performed by service roles.

#### 3.1 Create Monitoring View
```sql
-- Already exists in enterprise_saas_hardened_config_v2.sql
CREATE OR REPLACE VIEW security.service_role_operations AS
SELECT 
    al.timestamp,
    al.action,
    al.resource_type,
    al.resource_id,
    al.service_role,
    o.name as organization_name,
    al.metadata
FROM audit.activity_log al
LEFT JOIN public.organizations o ON al.organization_id = o.id
WHERE al.is_service_operation = TRUE
ORDER BY al.timestamp DESC;
```

#### 3.2 Set Up Grafana Dashboard
Create dashboard with panels for:

**Panel 1: Service Role Operations (Last 24h)**
```sql
SELECT 
  date_trunc('hour', timestamp) as time,
  count(*) as operations,
  service_role
FROM audit.activity_log
WHERE is_service_operation = TRUE
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY time, service_role
ORDER BY time;
```

**Panel 2: Cross-Tenant Operations by Type**
```sql
SELECT 
  action,
  count(*) as count,
  count(DISTINCT organization_id) as affected_orgs
FROM audit.activity_log
WHERE is_service_operation = TRUE
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY action
ORDER BY count DESC;
```

#### 3.3 Configure Alerts

**Alert 1: Unusual Service Role Activity**
```yaml
# Grafana alert configuration
name: High Service Role Operations
condition: |
  SELECT count(*) as operations
  FROM audit.activity_log
  WHERE is_service_operation = TRUE
    AND timestamp > NOW() - INTERVAL '5 minutes'
  HAVING count(*) > 100
threshold: 100 operations/5min
action: PagerDuty Critical + Slack #security-alerts
```

**Alert 2: Service Role Cross-Tenant Deletions**
```yaml
name: Service Role Data Deletion
condition: |
  SELECT count(*) FROM audit.activity_log
  WHERE is_service_operation = TRUE
    AND action IN ('DELETE', 'HARD_DELETE')
    AND timestamp > NOW() - INTERVAL '1 minute'
threshold: Any deletion
action: Immediate notification to security team
```

**Sign-off:** ☐ DevOps Engineer ☐ Security Lead

---

## 4. Edge Functions Security

### 🟡 HIGH: Deploy Edge Functions with Secure Secrets

**Objective:** Ensure all Edge Functions have proper secrets management and tenant isolation.

#### 4.1 Audit Existing Edge Functions
```bash
# List all Edge Functions
ls -la supabase/functions/

# Expected functions:
# - llm-proxy (LLM gateway with rate limiting)
# - parse-document (Document processing)
# - transcribe-audio (Audio transcription)
# - crm-oauth (OAuth integrations)
```

#### 4.2 Configure Secrets for Each Function
```bash
# Set secrets via Supabase CLI
supabase secrets set OPENAI_API_KEY="sk-..." --project-ref your-project-ref
supabase secrets set ANTHROPIC_API_KEY="sk-ant-..." --project-ref your-project-ref
supabase secrets set STRIPE_SECRET_KEY="sk_live_..." --project-ref your-project-ref

# Verify secrets (without exposing values)
supabase secrets list --project-ref your-project-ref
```

#### 4.3 Enforce Tenant Isolation in Edge Functions
```typescript
// Example: llm-proxy Edge Function
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  // Extract JWT from request
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Create Supabase client with user's JWT
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  // Get user context (RLS automatically enforced)
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response('Invalid token', { status: 401 });
  }

  // Extract organization_id from JWT claims
  const organization_id = user.app_metadata?.organization_id;
  if (!organization_id) {
    return new Response('No organization context', { status: 403 });
  }

  // All database operations now scoped to organization_id via RLS
  const { data, error: queryError } = await supabase
    .from('llm_usage')
    .insert({ organization_id, tokens_used: 1000 });
  
  // Process request...
});
```

#### 4.4 Test Edge Function Isolation
```bash
# Test llm-proxy with User A's token
curl -X POST https://your-project.supabase.co/functions/v1/llm-proxy \
  -H "Authorization: Bearer USER_A_JWT" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'

# Verify database shows correct organization_id
SELECT * FROM public.llm_usage ORDER BY created_at DESC LIMIT 1;
-- Expected: organization_id matches User A's org
```

**Sign-off:** ☐ Backend Lead ☐ Security Engineer

---

## 5. Storage RLS Policies

### 🔴 CRITICAL: Configure Storage Bucket Policies

**Objective:** Ensure file uploads are isolated by organization and proper access controls are enforced.

#### 5.1 Create Storage Buckets
```sql
-- Create buckets via Supabase Dashboard or SQL
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('documents', 'documents', false, 52428800, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']), -- 50MB limit
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']), -- 5MB limit
  ('workflows', 'workflows', false, 10485760, ARRAY['application/json']); -- 10MB limit
```

#### 5.2 Configure Storage RLS Policies

**Documents Bucket (Private)**
```sql
-- Users can upload to their own organization folder
CREATE POLICY "organization_upload_documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = security.get_user_organization_id()::text
);

-- Users can read files from their organization
CREATE POLICY "organization_read_documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = security.get_user_organization_id()::text
);

-- Users can delete their own files
CREATE POLICY "users_delete_own_documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = security.get_user_organization_id()::text
  AND owner = auth.uid()
);

-- Admins can delete any file in their org
CREATE POLICY "admins_delete_org_documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = security.get_user_organization_id()::text
  AND security.has_role('admin')
);
```

**Avatars Bucket (Public Read)**
```sql
-- Anyone can read avatars
CREATE POLICY "public_read_avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Users can upload their own avatar only
CREATE POLICY "users_upload_own_avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND name = auth.uid()::text || '.jpg'
);
```

#### 5.3 Test Storage Policies
```bash
# Test upload to documents bucket
curl -X POST https://your-project.supabase.co/storage/v1/object/documents/ORG_ID/test.pdf \
  -H "Authorization: Bearer USER_JWT" \
  -F file=@test.pdf

# Expected: Success if ORG_ID matches user's organization

# Test cross-tenant access (should fail)
curl -X GET https://your-project.supabase.co/storage/v1/object/documents/WRONG_ORG_ID/test.pdf \
  -H "Authorization: Bearer USER_JWT"

# Expected: 403 Forbidden
```

**Sign-off:** ☐ Backend Lead ☐ Security Engineer

---

## 6. Verification Queries

### 🔴 CRITICAL: Run Pre-Deployment Health Checks

#### 6.1 Verify RLS Enabled on All Tables
```sql
SELECT * FROM security.verify_rls_enabled();
```

**Expected Output:**
```
 table_name         | rls_enabled | policy_count | status  
--------------------+-------------+--------------+---------
 organizations      | t           | 8            | ✓ OK
 users              | t           | 6            | ✓ OK
 user_tenants       | t           | 4            | ✓ OK
 semantic_memory    | t           | 5            | ✓ OK
 workflows          | t           | 4            | ✓ OK
 workflow_executions| t           | 4            | ✓ OK
```

**Action if FAIL:** Any table with `rls_enabled = f` or `policy_count = 0` is a security risk. Enable RLS immediately.

#### 6.2 Run Comprehensive Health Check
```sql
SELECT * FROM security.health_check();
```

**Expected Output:**
```
 severity | check_name                    | value        | status
----------+-------------------------------+--------------+--------
 INFO     | Database Version              | 15.1         | ✓ OK
 INFO     | Extensions Loaded             | 5/5          | ✓ OK
 INFO     | Vector Extension              | Enabled      | ✓ OK
 INFO     | RLS Tables                    | 12/12        | ✓ OK
 INFO     | Active Policies               | 48           | ✓ OK
 INFO     | Audit Log Rows (24h)          | 1,234        | ✓ OK
 WARNING  | Slow Queries (>1s)            | 2            | ⚠️ Review
 INFO     | Table Bloat                   | <10%         | ✓ OK
 INFO     | Connection Pool               | 45/100       | ✓ OK
```

**Action Items:**
- Review any `WARNING` or `ERROR` severity items
- Investigate slow queries and add indexes if needed
- Ensure all critical extensions are loaded

#### 6.3 Service Role Audit Verification
```sql
-- Verify service role operations are logged
SELECT 
  count(*) as total_operations,
  count(DISTINCT service_role) as unique_service_roles,
  count(DISTINCT organization_id) as affected_orgs
FROM audit.activity_log
WHERE is_service_operation = TRUE
  AND timestamp > NOW() - INTERVAL '7 days';
```

**Expected:** If service roles are being used, you should see logged operations.

#### 6.4 Performance Baseline
```sql
-- Get baseline query performance
SELECT 
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%security.get_user_organization_id%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Expected:** Mean execution time <1ms after JWT claims are configured.

**Sign-off:** ☐ Database Admin ☐ DevOps Lead

---

## 7. Final Deployment Checklist

### Pre-Deployment Sign-off

| Item | Status | Sign-off | Date |
|------|--------|----------|------|
| Staging database cleaned (test data removed) | ☐ | ___________ | ____ |
| Database backup verified | ☐ | ___________ | ____ |
| Storage buckets emptied | ☐ | ___________ | ____ |
| JWT custom claims configured | ☐ | ___________ | ____ |
| Cross-tenant access tests passed | ☐ | ___________ | ____ |
| Service role monitoring alerts active | ☐ | ___________ | ____ |
| Edge Function secrets configured | ☐ | ___________ | ____ |
| Storage RLS policies deployed | ☐ | ___________ | ____ |
| `security.verify_rls_enabled()` passed | ☐ | ___________ | ____ |
| `security.health_check()` passed | ☐ | ___________ | ____ |
| Grafana dashboards deployed | ☐ | ___________ | ____ |
| PagerDuty alerts configured | ☐ | ___________ | ____ |
| Rollback plan documented | ☐ | ___________ | ____ |

### Post-Deployment Verification (Within 1 Hour)

```bash
# 1. Verify production database health
psql $DATABASE_URL -c "SELECT * FROM security.health_check();"

# 2. Check for RLS policy violations (should be 0)
psql $DATABASE_URL -c "SELECT count(*) FROM audit.activity_log 
WHERE action = 'RLS_VIOLATION' AND timestamp > NOW() - INTERVAL '1 hour';"

# 3. Monitor service role operations
psql $DATABASE_URL -c "SELECT * FROM security.service_role_operations LIMIT 10;"

# 4. Test user authentication and JWT claims
curl -X POST https://your-project.supabase.co/auth/v1/token \
  -H "apikey: PROD_ANON_KEY" \
  -d '{"email": "admin@yourcompany.com", "password": "..."}'
# Decode JWT and verify organization_id is present
```

### Emergency Rollback Procedure

If critical issues are discovered:

1. **Immediate:** Enable maintenance mode
2. **Database:** Revert to last known good migration
3. **Edge Functions:** Roll back to previous version
4. **Notify:** Alert all stakeholders via PagerDuty/Slack

---

## 8. Compliance Documentation

### Required Documentation for Audit

Create the following documents before production:

- ☐ **Data Flow Diagram** - Show how organization_id flows through system
- ☐ **RLS Policy Documentation** - List all policies and their purpose
- ☐ **Service Role Usage Log** - Document which services use service_role and why
- ☐ **Incident Response Plan** - Cross-tenant data breach procedures
- ☐ **Data Retention Policy** - When/how soft-deleted records are hard-deleted

**Sign-off:** ☐ Compliance Officer ☐ Security Lead

---

## Contact Information

**Security Incidents:** security@yourcompany.com | PagerDuty #security-on-call  
**DevOps On-Call:** devops@yourcompany.com | PagerDuty #devops-on-call  
**Database Admin:** dba@yourcompany.com

---

**Document Version:** 1.0  
**Next Review:** Post-Production (1 week after launch)
