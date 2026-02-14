---
title: Deployment Guide (Legacy Consolidated)
owner: team-platform
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: deprecated
---

> [!WARNING]
> **DEPRECATED**: Use the authoritative runbook in `docs/operations/runbooks/` instead.

# Deployment Guide (Legacy Consolidated)

This document has been split.

- **Authoritative runbook:** [runbooks/deployment-runbook.md](./runbooks/deployment-runbook.md)
- **Generated reference:** [reference/deployment-reference.generated.md](./reference/deployment-reference.generated.md)

Supabase Staging Database Reset
WARNING: This will drop ALL user objects

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

Reset Complete - Next Steps
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

---

## ValueCanvas v1.0.0 Release Notes

*Source: `operations/deployment/release-notes.md`*

**Release Date:** December 5, 2025
**Release Type:** Major Release (1.0.0)
**Deployment Status:** Ready for Production

---

## 🎉 Overview

ValueCanvas 1.0.0 represents the culmination of a comprehensive platform modernization effort, delivering a production-ready AI-powered value case management system. This release includes complete identity consolidation, enhanced SDUI architecture, comprehensive onboarding flows, and enterprise-grade security and compliance features.

---

## ✨ Highlights

### 🏷️ Brand Identity Consolidation
- **Complete platform rebrand** from ValueVerse to ValueCanvas
- **7 agents renamed** to align with documentation and user-facing terminology
- Consistent branding across all code, documentation, and UI elements

### 🎨 Enhanced Server-Driven UI (SDUI)
- **Nested layout support** for complex UI compositions
- **Enhanced error boundaries** with graceful degradation
- **Validation & sanitization** for XSS prevention
- **Recursive rendering engine** for dynamic layouts

### 🚀 Onboarding Excellence
- **5-Minute Demo Flow** to first value
- **Interactive Interface Tour** with step-by-step guidance
- **12+ Prompt Templates** for common scenarios
- **Demo Analytics** to track conversion funnels

### 📊 Value Metrics & Analytics
- **Comprehensive value tracking** across time saved, revenue identified, cost reduced
- **Real-time dashboards** with trend analysis
- **Leaderboard system** for gamification
- **Demo analytics** with drop-off analysis

### 🧠 Intelligence & Memory
- **Agent Memory System** with semantic search
- **Confidence scoring** and feedback loops
- **LLM caching** for performance
- **Response streaming** for real-time updates

### 🔒 Security & Compliance
- **SDUI sanitization** with DOMPurify integration
- **Prompt injection defense**
- **GDPR & CCPA compliant**
- **SOC 2 ready**
- **Comprehensive audit logging**

### ⚡ Performance & Reliability
- **Load testing framework** (Locust)
- **Performance benchmarks** (P95 < 100ms for SDUI render)
- **Circuit breakers** and fallback mechanisms
- **Disaster recovery** procedures

### 📚 Documentation Overhaul
- Complete architecture documentation
- Deployment guide
- Troubleshooting guide
- Compliance audit report
- API documentation

---

## 🎯 EPICs Completed

### EPIC 1: Identity Consolidation ✅
**Tasks:** #001-#007
**Impact:** Unified branding, consistent terminology

**Changes:**
- Renamed ValueVerse → ValueCanvas across entire codebase
- Agent renames:
  - `OutcomeEngineerAgent` → `OpportunityAgent`
  - `InterventionDesignerAgent` → `TargetAgent`
  - `RealizationLoopAgent` → `RealizationAgent`
  - `ValueEvalAgent` → `IntegrityAgent`
- Updated 500+ files with consistent naming
- Created comprehensive agent mapping documentation

### EPIC 2: Core Architecture + SDUI ✅
**Tasks:** #008-#011
**Impact:** Robust, scalable SDUI system

**Features:**
- Nested layout rendering with recursive support
- Enhanced error boundaries with fallback UI
- OpenAI function calling schema for layout generation
- Validation pipeline for SDUI schemas
- Integration test suite (agent → render → undo/redo)
- Canvas Store integration with history tracking

### EPIC 3: Onboarding Experience ✅
**Tasks:** #012-#019
**Impact:** Reduced time-to-value, improved conversion

**Features:**

---

## Production Deployment Runbook

*Source: `operations/deployment/PRODUCTION_RUNBOOK.md`*

**Last Updated:** 2024-11-29
**Version:** 1.0
**Status:** ✅ PRODUCTION READY

---

## 🎯 Overview

This runbook provides step-by-step instructions for deploying the Enterprise Multi-Tenant Secrets Management system to production.

**System Components:**
- Multi-tenant secrets manager (Sprint 1)
- Provider abstraction (AWS/Vault) (Sprint 2)
- Kubernetes CSI driver integration (Sprint 3)
- Advanced features (versioning, encryption) (Sprint 4)

---

## 📋 Pre-Deployment Checklist

### Infrastructure

- [ ] Kubernetes cluster (v1.24+) deployed
- [ ] Secrets Store CSI Driver installed
- [ ] HashiCorp Vault or AWS Secrets Manager configured
- [ ] Prometheus + Grafana for monitoring
- [ ] Database (PostgreSQL) for audit logs
- [ ] Redis for rate limiting/caching

### Configuration

- [ ] Environment variables reviewed
- [ ] Secrets properly configured in provider
- [ ] RLS policies applied to database
- [ ] Network policies configured
- [ ] TLS certificates valid

### Security

- [ ] Security audit completed
- [ ] Penetration testing passed
- [ ] Compliance requirements verified (SOC 2, GDPR)
- [ ] Incident response plan documented
- [ ] Backup/recovery procedures tested

### Team Readiness

- [ ] Ops team trained on runbook
- [ ] On-call rotation established
- [ ] Monitoring dashboards configured
- [ ] Alert channels tested (Slack/PagerDuty)

---

## 🚀 Deployment Steps

### Phase 1: Infrastructure Setup (Day 1)

#### 1.1 Install Secrets Store CSI Driver

```bash
# Add Helm repo
helm repo add secrets-store-csi-driver \
  https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts

# Install driver
helm install csi-secrets-store \
  secrets-store-csi-driver/secrets-store-csi-driver \
  --namespace kube-system \
  --set syncSecret.enabled=true

# Verify installation
kubectl get pods -n kube-system | grep csi-secrets-store
```

**Expected Output:**
```
csi-secrets-store-xxx   2/2   Running
```

#### 1.2 Install Vault CSI Provider (if using Vault)

```bash
# Install Vault provider
kubectl apply -f \
  https://raw.githubusercontent.com/hashicorp/vault-csi-provider/main/deployment/vault-csi-provider.yaml

# Verify
kubectl get pods -n kube-system | grep vault-csi
```

#### 1.3 Configure Vault Authentication

```bash
# Enable Kubernetes auth in Vault
vault auth enable kubernetes

# Configure Kubernetes auth
vault write auth/infra/infra/k8s/config \
  kubernetes_host="https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

# Create policy
vault policy write valuecanvas-production - <<EOF
path "secret/data/production/tenants/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/metadata/production/tenants/*" {
  capabilities = ["read", "list", "delete"]
}
EOF

# Create role
vault write auth/infra/infra/k8s/role/valuecanvas-production \
  bound_service_account_names=valuecanvas \
  bound_service_account_namespaces=production \
  policies=valuecanvas-production \
  ttl=24h
```

---

### Phase 2: Database Setup (Day 1)

#### 2.1 Apply Database Migrations

```bash
# Navigate to migrations directory
cd supabase/migrations

# Apply audit log table
psql $DATABASE_URL -f 20241129_secret_audit_logs.sql

# Verify table created
psql $DATABASE_URL -c "\d secret_audit_logs"
```

**Expected Columns:**
- id (UUID)
- tenant_id
- user_id
- secret_key
- action
- result
- metadata
- timestamp

#### 2.2 Verify RLS Policies

```bash
# Check RLS enabled
psql $DATABASE_URL -c "
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'secret_audit_logs';
"
```

**Expected:** `rowsecurity = t`

#### 2.3 Test Audit Logging

```bash
# Insert test audit log
psql $DATABASE_URL -c "
SET app.current_user_role = 'system';
INSERT INTO secret_audit_logs (tenant_id, user_id, secret_key, action, result)
VALUES ('test-tenant', 'system', 'test-secret', 'READ', 'SUCCESS');
"

# Verify insert
psql $DATABASE_URL -c "
SELECT * FROM secret_audit_logs
WHERE tenant_id = 'test-tenant'
LIMIT 1;
"
```

---

### Phase 3: Deploy Application (Day 2)

#### 3.1 Create Kubernetes Namespace

```bash
# Create namespace
kubectl create namespace production

# Label namespace
kubectl label namespace production \
  environment=production \
  managed-by=valuecanvas
```

#### 3.2 Deploy SecretProviderClass

```bash
# Apply for Vault
kubectl apply -f infra/infra/k8s/secrets/secret-provider-class-vault.yaml

# OR for AWS
kubectl apply -f infra/infra/k8s/secrets/secret-provider-class-aws.yaml

# Verify
kubectl get secretproviderclass -n production
```

#### 3.3 Create Service Account

```bash
# Apply service account and RBAC
kubectl apply -f infra/infra/k8s/secrets/deployment-with-csi.yaml

# Verify service account
kubectl get serviceaccount valuecanvas -n production
```

#### 3.4 Deploy Application

```bash
# Build and push image
docker build -t valuecanvas/api:v1.0.0 .
docker push valuecanvas/api:v1.0.0

# Update deployment with new image
kubectl set image deployment/valuecanvas-api \
  api=valuecanvas/api:v1.0.0 \
  -n production

# Watch rollout
kubectl rollout status deployment/valuecanvas-api -n production
```

**Expected Output:**
```
deployment "valuecanvas-api" successfully rolled out
```

#### 3.5 Verify Secret Mounting

```bash
# Exec into pod
kubectl exec -it deployment/valuecanvas-api -n production -- /bin/sh

# Check mounted secrets
ls -la /mnt/secrets

# Expected files:
# database-username
# database-password
# together-api-key
# jwt-secret
# supabase-*
```

---

### Phase 4: Configure Monitoring (Day 2)

#### 4.1 Apply Prometheus Alerts

```bash
# Apply alert rules
kubectl apply -f infra/infra/k8s/monitoring/prometheus-alerts.yaml

# Verify alerts loaded
kubectl get prometheusrule -n monitoring
```

#### 4.2 Import Grafana Dashboard

```bash
# Open Grafana UI
# Navigate to Dashboards > Import
# Upload: infra/infra/k8s/monitoring/grafana-dashboard.json

# Verify panels:
# - Secret Access Rate
# - Access Latency (p95)
# - Cache Hit Rate
# - Rotation Success Rate
```

#### 4.3 Test Metrics Endpoint

```bash
# Port forward to service
kubectl port-forward svc/valuecanvas-api 3000:80 -n production

# Query metrics
curl http://localhost:3000/metrics | grep secret_

# Expected metrics:
# secret_access_total
# secret_access_latency_seconds
# secret_rotation_total
```

---

### Phase 5: Enable Secret Rotation (Day 3)

#### 5.1 Configure Rotation Policies

```typescript
// In application startup code
import { createRotationScheduler, RotationPolicies } from './secrets/SecretRotationScheduler'

const scheduler = createRotationScheduler(provider)
scheduler.start()

// Schedule for each tenant
scheduler.scheduleRotation({
  tenantId: 'acme-corp',
  secretKey: 'database_credentials',
  policy: RotationPolicies.DATABASE_CREDENTIALS,
  cronSchedule: '0 2 */90 * *' // Every 90 days at 2 AM
})
```

#### 5.2 Test Manual Rotation

```bash
# Trigger test rotation
curl -X POST https://api.valuecanvas.io/admin/secrets/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test-tenant",
    "secretKey": "test_secret"
  }'

# Verify in logs
kubectl logs -f deployment/valuecanvas-api -n production | grep "SECRET"
```

---

## 🔄 Post-Deployment Verification

### Smoke Tests

```bash
# 1. Health check
curl https://api.valuecanvas.io/health

# Expected: {"status": "healthy", "uptime": ...}

# 2. Secret access test
curl https://api.valuecanvas.io/api/test/secret-access \
  -H "Authorization: Bearer $API_KEY"

# Expected: {"success": true}

# 3. Metrics endpoint
curl https://api.valuecanvas.io/metrics

# Expected: Prometheus metrics

# 4. Audit log test
psql $DATABASE_URL -c "
SELECT COUNT(*) FROM secret_audit_logs
WHERE timestamp > NOW() - INTERVAL '1 hour';
"

# Expected: >0 entries
```

### Performance Tests

```bash
# Run load test (100 req/sec for 1 minute)
wrk -t4 -c100 -d60s \
  -H "Authorization: Bearer $API_KEY" \
  https://api.valuecanvas.io/api/secrets/test

# Expected metrics:
# - Latency p50 < 50ms
# - Latency p95 < 100ms
# - Error rate < 0.1%
```

---

## 🚨 Rollback Procedures

### Application Rollback

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/valuecanvas-api -n production

# Verify rollback
kubectl rollout status deployment/valuecanvas-api -n production

# Check specific revision
kubectl rollout history deployment/valuecanvas-api -n production

# Rollback to specific revision
kubectl rollout undo deployment/valuecanvas-api \
  --to-revision=2 \
  -n production
```

### Database Rollback

```bash
# Run rollback migration
psql $DATABASE_URL -f supabase/migrations/rollback/20241129_secret_audit_logs_rollback.sql

# Verify table dropped
psql $DATABASE_URL -c "\dt secret_audit_logs"

# Expected: relation does not exist
```

### Secret Rollback

```bash
# Rollback secret to previous version
curl -X POST https://api.valuecanvas.io/admin/secrets/rollback \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "tenantId": "tenant-id",
    "secretKey": "secret-key",
    "targetVersion": "v1234567890-abc123"
  }'
```

---

## 🔍 Monitoring & Alerts

### Key Metrics to Watch

**Application Metrics:**
- Secret access rate: <1000 req/sec normal
- Access latency p95: <100ms
- Error rate: <0.1%
- Cache hit rate: >80%

**Rotation Metrics:**
- Success rate: >99%
- Duration p95: <5 minutes
- Failure count: 0

**Infrastructure:**
- Pod CPU: <70%
- Pod memory: <80%
- Database connections: <80% of pool

### Critical Alerts

**Immediate Response (Page On-Call):**
- SecretProviderDown
- SecretRotationFailure
- LowRotationSuccessRate (<99%)
- HighSecretAccessErrorRate (>10/min)

**Investigation Required:**
- HighSecretAccessLatency (>500ms)
- LowCacheHitRate (<70%)
- ExcessiveSecretAccess (>100 req/sec)

---

## 🐛 Troubleshooting

### Issue: Secrets Not Mounting

**Symptoms:** Pods can't read `/mnt/secrets`

**Diagnosis:**
```bash
# Check CSI driver pods
kubectl get pods -n kube-system | grep csi

# Check SecretProviderClass
kubectl describe secretproviderclass valuecanvas-secrets -n production

# Check pod events
kubectl describe pod <pod-name> -n production
```

**Resolution:**
1. Verify CSI driver running
2. Check SecretProviderClass configuration
3. Verify Vault/AWS credentials
4. Restart pod

---

### Issue: High Latency

**Symptoms:** p95 latency >500ms

**Diagnosis:**
```bash
# Check cache hit rate
curl http://localhost:3000/metrics | grep cache_hits

# Check provider latency
kubectl logs -f deployment/valuecanvas-api | grep latency_ms
```

**Resolution:**
1. Increase cache TTL
2. Add more replicas
3. Check provider health
4. Review network policies

---

### Issue: Rotation Failures

**Symptoms:** Rotation success rate <99%

**Diagnosis:**
```bash
# Check rotation logs
kubectl logs -f deployment/valuecanvas-api | grep rotation

# Check provider status
vault status # or aws secretsmanager describe-secret
```

**Resolution:**
1. Verify provider connectivity
2. Check rotation policy configuration
3. Review grace period settings
4. Test manual rotation

---

## 📞 Escalation

### On-Call Contacts

**Level 1 - Operations:**
- Primary: ops-team@company.com
- Secondary: devops-lead@company.com

**Level 2 - Engineering:**
- Primary: eng-lead@company.com
- Secondary: security-team@company.com

**Level 3 - Executive:**
- CTO: cto@company.com

### Escalation Criteria

**Immediate (L3):**
- Security breach detected
- Data loss
- Complete service outage >30min

**Urgent (L2):**
- Rotation failures affecting production
- High error rates (>5%)
- Performance degradation >50%

**Standard (L1):**
- Individual service issues
- Configuration problems
- Non-critical alerts

---

## 📚 Additional Resources

### Documentation
- [Sprint 1 Complete](../security/SPRINT1_COMPLETE.md) - Multi-tenancy
- [Sprint 2 Complete](../security/SPRINT2_COMPLETE.md) - Provider abstraction
- [Sprint 3 Complete](../security/SPRINT3_COMPLETE.md) - Kubernetes integration
- [Sprint 4 Complete](../security/SPRINT4_COMPLETE.md) - Advanced features

### External Resources
- [Kubernetes CSI Driver Docs](https://secrets-store-csi-driver.sigs.k8s.io/)
- [HashiCorp Vault Docs](https://www.vaultproject.io/docs)
- [AWS Secrets Manager Docs](https://docs.aws.amazon.com/secretsmanager/)

---

**Runbook Version:** 1.0
**Last Updated:** 2024-11-29
**Next Review:** 2024-12-29
**Maintained By:** DevOps Team

---

## Quick Reference: Pre-Production Deployment

*Source: `operations/deployment/QUICK_REFERENCE.md`*

## 🚀 Quick Start

```bash
# 0. Reset staging database (FIRST TIME ONLY)
psql $DATABASE_URL -f scripts/reset-staging-database.sql

# 0b. Re-apply migrations after reset
supabase db push

# 0c. Delete storage files
supabase storage rm documents --recursive
supabase storage rm avatars --recursive

# 1. Run automated verification
./scripts/verify-production.sh staging

# 2. Run SQL verification directly
psql $DATABASE_URL -f scripts/verify-production-readiness.sql

# 3. Run RLS policy tests
npm run test:rls
```

## ✅ Critical Verification Queries

### Verify RLS Enabled
```sql
SELECT * FROM security.verify_rls_enabled();
```

Expected: All tables return `rls_enabled = t` and `policy_count > 0`

### Database Health Check
```sql
SELECT * FROM security.health_check();
```

Expected: No `ERROR` severity items

### Service Role Operations
```sql
SELECT * FROM security.service_role_operations LIMIT 10;
```

Expected: All service operations logged with `is_service_operation = true`

## 🔧 JWT Custom Claims Setup

### Step 1: Create Hook Function
```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims jsonb;
  user_org_id uuid;
  user_role text;
BEGIN
  SELECT organization_id, role INTO user_org_id, user_role
  FROM public.users WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(user_org_id::text));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
```

### Step 2: Register in Supabase Dashboard
1. Go to **Database** → **Webhooks**
2. Enable **custom access token hook**
3. Select `public.custom_access_token_hook`
4. Save

### Step 3: Test JWT Claims
```bash
# Get JWT token
TOKEN=$(curl -X POST https://your-project.supabase.co/auth/v1/token \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}' | jq -r '.access_token')

# Decode and verify organization_id is present
echo $TOKEN | jwt decode -
```

## 🔒 Storage RLS Policies

### Documents Bucket (Private)
```sql
-- Upload policy
CREATE POLICY "organization_upload_documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = security.get_user_organization_id()::text
);

-- Read policy
CREATE POLICY "organization_read_documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = security.get_user_organization_id()::text
);
```

### Test Storage Isolation
```bash
# Upload to correct org folder (should succeed)
curl -X POST https://your-project.supabase.co/storage/v1/object/documents/{YOUR_ORG_ID}/test.pdf \
  -H "Authorization: Bearer YOUR_JWT" \
  -F file=@test.pdf

# Upload to wrong org folder (should fail with 403)
curl -X POST https://your-project.supabase.co/storage/v1/object/documents/{WRONG_ORG_ID}/test.pdf \
  -H "Authorization: Bearer YOUR_JWT" \
  -F file=@test.pdf
```

## 📊 Monitoring Setup

### Grafana Dashboard Query: Service Role Operations
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

### Alert: Unusual Service Role Activity
```yaml
condition: |
  SELECT count(*) FROM audit.activity_log
  WHERE is_service_operation = TRUE
    AND timestamp > NOW() - INTERVAL '5 minutes'
  HAVING count(*) > 100
threshold: 100 operations/5min
action: PagerDuty + Slack #security-alerts
```

## 🧪 Cross-Tenant Testing

### Test Scenario
```sql
-- Create test orgs
INSERT INTO public.organizations (id, name, slug, status) VALUES
  (gen_random_uuid(), 'Test Org A', 'test-org-a', 'active'),
  (gen_random_uuid(), 'Test Org B', 'test-org-b', 'active');

-- Simulate User A context
SET request.jwt.claims = '{"sub": "user-a-uuid", "organization_id": "org-a-uuid"}';

-- Try to access Org B data (should return 0 rows)
SELECT * FROM public.organizations WHERE id = 'org-b-uuid';
```

## 📋 Pre-Deployment Checklist

- [ ] `security.verify_rls_enabled()` passes
- [ ] `security.health_check()` passes
- [ ] JWT custom claims configured
- [ ] Cross-tenant access tests passed
- [ ] Service role monitoring configured
- [ ] Edge Functions secrets deployed
- [ ] Storage RLS policies active
- [ ] Grafana dashboards deployed
- [ ] PagerDuty alerts configured
- [ ] Rollback plan documented

## 🆘 Emergency Contacts

- **Security Incidents:** PagerDuty #security-on-call
- **DevOps On-Call:** PagerDuty #devops-on-call
- **Database Issues:** dba@yourcompany.com

## 📚 Documentation

- Full Checklist: `docs/deployment/PRE_PRODUCTION_CHECKLIST.md`
- Database Config: `docs/database/enterprise_saas_hardened_config_v2.sql`
- Review Analysis: `docs/database/Proposed Changes Review Analysis (1).md`

---

**Last Updated:** 2025-12-10

---

## Terraform Workflow Simulation

*Source: `operations/deployment/terraform-workflow-simulation.md`*

## Overview

This document simulates what would happen when the Terraform PR is pushed to GitHub, demonstrating the complete workflow from PR creation to merge.

---

## Timeline of Events

### T+0:00 - PR Created

**Action**: Developer pushes branch and creates PR

```bash
git push origin feature/add-backup-s3-bucket
gh pr create --title "Add S3 bucket for automated backups"
```

**GitHub Response**:
```
✓ Created pull request #123
https://github.com/org/ValueCanvas/pull/123
```

**PR Details**:
- **Title**: Add S3 bucket for automated backups
- **Branch**: `feature/add-backup-s3-bucket`
- **Base**: `main`
- **Files Changed**: 1
- **Lines Added**: 68
- **Lines Removed**: 0

---

### T+0:05 - Workflow Triggered

**Event**: PR creation triggers `terraform-check.yml` workflow

**Trigger Condition Met**:
```yaml
on:
  pull_request:
    paths:
      - 'infrastructure/terraform/**'  # ✅ Matched
```

**Workflow Started**:
```
Run #456 started
Workflow: Terraform PR Check
Triggered by: pull_request
Branch: feature/add-backup-s3-bucket
Commit: 67441e8
```

---

### T+0:10 - Checkout & Setup

**Step 1: Checkout code** ✅
```
Checking out code from feature/add-backup-s3-bucket
✓ Checkout complete
```

**Step 2: Configure AWS credentials** ✅
```
Configuring AWS credentials
Region: us-east-1
✓ Credentials configured
```

**Step 3: Setup Terraform** ✅
```
Setting up Terraform 1.5.0
✓ Terraform installed
```

---

### T+0:20 - Format Check

**Step 4: Terraform Format Check** ✅

```bash
terraform fmt -check -recursive
```

**Output**:
```
✓ All files properly formatted
```

**Result**: ✅ PASS

---

### T+0:30 - Initialize

**Step 5: Terraform Init** ✅

```bash
terraform init -backend=false
```

**Output**:
```
Initializing the backend...
Initializing provider plugins...
- Finding hashicorp/aws versions matching "~> 5.0"...
- Installing hashicorp/aws v5.25.0...
- Installed hashicorp/aws v5.25.0

Terraform has been successfully initialized!
```

**Result**: ✅ PASS

---

### T+0:45 - Validate

**Step 6: Terraform Validate** ✅

```bash
terraform validate -no-color
```

**Output**:
```
Success! The configuration is valid.
```

**Result**: ✅ PASS

---

### T+1:00 - Plan

**Step 7: Terraform Plan** ✅

```bash
terraform plan -no-color -out=tfplan
```

**Output**:
```
Terraform used the selected providers to generate the following execution plan.
Resource actions are indicated with the following symbols:
  + create

Terraform will perform the following actions:

  # aws_s3_bucket.backups will be created
  + resource "aws_s3_bucket" "backups" {
      + acceleration_status         = (known after apply)
      + acl                          = (known after apply)
      + arn                          = (known after apply)
      + bucket                       = "valuecanvas-staging-backups"
      + bucket_domain_name           = (known after apply)
      + bucket_regional_domain_name  = (known after apply)
      + force_destroy                = false
      + hosted_zone_id               = (known after apply)
      + id                           = (known after apply)
      + object_lock_enabled          = (known after apply)
      + policy                       = (known after apply)
      + region                       = (known after apply)
      + request_payer                = (known after apply)
      + tags                         = {
          + "Compliance"  = "Required"
          + "Environment" = "staging"
          + "ManagedBy"   = "Terraform"
          + "Name"        = "valuecanvas-staging-backups"
          + "Project"     = "ValueCanvas"
          + "Purpose"     = "Database and configuration backups"
        }
      + tags_all                     = {
          + "Compliance"  = "Required"
          + "Environment" = "staging"
          + "ManagedBy"   = "Terraform"
          + "Name"        = "valuecanvas-staging-backups"
          + "Owner"       = "DevOps"
          + "Project"     = "ValueCanvas"
          + "Purpose"     = "Database and configuration backups"
        }
      + website_domain               = (known after apply)
      + website_endpoint             = (known after apply)
    }

  # aws_s3_bucket_versioning.backups will be created
  + resource "aws_s3_bucket_versioning" "backups" {
      + bucket = (known after apply)
      + id     = (known after apply)

      + versioning_configuration {
          + mfa_delete = (known after apply)
          + status     = "Enabled"
        }
    }

  # aws_s3_bucket_server_side_encryption_configuration.backups will be created
  + resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
      + bucket = (known after apply)
      + id     = (known after apply)

      + rule {
          + apply_server_side_encryption_by_default {
              + sse_algorithm = "AES256"
            }
        }
    }

  # aws_s3_bucket_lifecycle_configuration.backups will be created
  + resource "aws_s3_bucket_lifecycle_configuration" "backups" {
      + bucket = (known after apply)
      + id     = (known after apply)

      + rule {
          + id     = "delete-old-backups"
          + status = "Enabled"

          + expiration {
              + days = 90
            }

          + noncurrent_version_expiration {
              + noncurrent_days = 30
            }
        }

      + rule {
          + id     = "transition-to-glacier"
          + status = "Enabled"

          + transition {
              + days          = 30
              + storage_class = "GLACIER"
            }
        }
    }

  # aws_s3_bucket_public_access_block.backups will be created
  + resource "aws_s3_bucket_public_access_block" "backups" {
      + block_public_acls       = true
      + block_public_policy     = true
      + bucket                  = (known after apply)
      + id                      = (known after apply)
      + ignore_public_acls      = true
      + restrict_public_buckets = true
    }

Plan: 5 to add, 0 to change, 0 to destroy.
```

**Summary Extracted**:
- Resources to add: 5
- Resources to change: 0
- Resources to destroy: 0

**Result**: ✅ PASS

---

### T+1:30 - Generate Summary

**Step 8: Generate Plan Summary** ✅

```bash
# Extract metrics
RESOURCES_TO_ADD=5
RESOURCES_TO_CHANGE=0
RESOURCES_TO_DESTROY=0
HAS_DESTROYS=false
```

**Result**: ✅ Summary generated

---

### T+1:45 - Post Comment

**Step 9: Post Plan to PR** ✅

**Comment Posted**:

---

## Terraform Plan Results 📋

**Environment**: `staging`
**Terraform Version**: `1.5.0`

### Validation Status

| Check | Status |
|-------|--------|
| Format | ✅ `terraform fmt` |
| Init | ✅ `terraform init` |
| Validate | ✅ `terraform validate` |
| Plan | ✅ `terraform plan` |

### Resource Changes

| Action | Count |
|--------|-------|
| 🟢 Create | 5 |
| 🟡 Update | 0 |
| 🔴 Destroy | 0 |

### Resources to Create

- `aws_s3_bucket.backups`
- `aws_s3_bucket_versioning.backups`
- `aws_s3_bucket_server_side_encryption_configuration.backups`
- `aws_s3_bucket_lifecycle_configuration.backups`
- `aws_s3_bucket_public_access_block.backups`

### Plan Output

<details>
<summary>Click to expand full plan</summary>

```terraform
[Full plan output from above]
```

</details>

---

**Workflow**: [`Terraform PR Check`](https://github.com/org/ValueCanvas/actions/runs/456)
**Commit**: `67441e8`

---

**Result**: ✅ Comment posted successfully

---

### T+2:00 - Upload Artifacts

**Step 10: Upload Plan Artifact** ✅

```
Uploading artifacts...
- tfplan (binary plan file)
- plan_output.txt (text output)
✓ Artifacts uploaded
Retention: 30 days
```

**Result**: ✅ Artifacts uploaded

---

### T+2:10 - Workflow Complete

**Workflow Summary**:
```
✓ Terraform PR Check completed successfully
Duration: 2 minutes 10 seconds
Status: Success ✅

Steps:
✅ Checkout code
✅ Configure AWS credentials
✅ Setup Terraform
✅ Format check
✅ Initialize
✅ Validate
✅ Plan
✅ Generate summary
✅ Post comment
✅ Upload artifacts
```

---

## Team Review Phase

### T+10:00 - First Review

**@reviewer1** (DevOps Lead):
> Looks good! The S3 bucket configuration follows our best practices:
> - ✅ Encryption enabled
> - ✅ Versioning enabled
> - ✅ Public access blocked
> - ✅ Lifecycle policies configured
> - ✅ Proper tagging
>
> The cost estimate of ~$6/month is reasonable for backup storage.
>
> **Approved** ✅

---

### T+15:00 - Second Review

**@reviewer2** (Security Team):
> Security review:
> - ✅ Server-side encryption (AES256)
> - ✅ Public access blocked
> - ✅ Versioning for data protection
> - ✅ Lifecycle policies prevent indefinite storage
>
> One question: Should we use KMS encryption instead of AES256 for better key management?
>
> **Approved with suggestion** ✅

---

### T+20:00 - Author Response

**@author**:
> @reviewer2 Good point about KMS! For this initial implementation, I went with AES256 to keep it simple and avoid additional KMS costs (~$1/month per key).
>
> We can upgrade to KMS in a follow-up PR if needed. The bucket configuration makes it easy to change:
>
> ```terraform
> sse_algorithm     = "aws:kms"
> kms_master_key_id = aws_kms_key.backups.arn
> ```
>
> What do you think?

---

### T+25:00 - Security Team Response

**@reviewer2**:
> @author Makes sense! Let's start with AES256 and evaluate KMS later based on compliance requirements.
>
> **Final approval** ✅

---

### T+30:00 - Third Review

**@reviewer3** (Backend Team):
> This will be useful for our database backup automation. A few questions:
>
> 1. Will this bucket be used for all environments (dev/staging/prod)?
> 2. Do we need cross-region replication for disaster recovery?
> 3. Should we add bucket notifications for backup monitoring?
>
> **Approved** ✅ (questions are for future enhancements)

---

### T+35:00 - Author Response

**@author**:
> @reviewer3 Great questions!
>
> 1. **Environments**: Yes, each environment gets its own bucket:
>    - `valuecanvas-development-backups`
>    - `valuecanvas-staging-backups`
>    - `valuecanvas-production-backups`
>
> 2. **Cross-region replication**: Good idea for production! Let's add that in a follow-up PR.
>
> 3. **Bucket notifications**: Also a great idea! We can set up SNS notifications for:
>    - Backup completion
>    - Backup failures
>    - Lifecycle transitions
>
> I'll create follow-up issues for these enhancements.

---

## Merge Phase

### T+40:00 - Ready to Merge

**Status**:
- ✅ All checks passed
- ✅ 3 approvals received
- ✅ No requested changes
- ✅ No conflicts with base branch

**Author merges PR**:

```bash
gh pr merge 123 --squash --delete-branch
```

**Output**:
```
✓ Squashed and merged pull request #123 (Add S3 bucket for automated backups)
✓ Deleted branch feature/add-backup-s3-bucket
✓ Pull request #123 merged into main
```

---

### T+40:30 - Production Deployment Triggered

**Event**: Merge to main triggers `deploy-production.yml` workflow

**Workflow Started**:
```
Run #789 started
Workflow: Deploy to Production
Triggered by: push to main
Commit: 67441e8 (squashed)
```

---

### T+41:00 - Deployment Steps

**1. Run Tests** ✅
```
Running unit tests...
✓ All tests passed
```

**2. Security Scan** ✅
```
Running Trivy security scan...
✓ No vulnerabilities found
```

**3. Terraform Plan** ✅
```
Running terraform plan...
Plan: 5 to add, 0 to change, 0 to destroy
✓ Plan generated
```

**4. Terraform Apply** ✅
```
Running terraform apply...

aws_s3_bucket.backups: Creating...
aws_s3_bucket.backups: Creation complete after 2s [id=valuecanvas-production-backups]

aws_s3_bucket_versioning.backups: Creating...
aws_s3_bucket_versioning.backups: Creation complete after 1s

aws_s3_bucket_server_side_encryption_configuration.backups: Creating...
aws_s3_bucket_server_side_encryption_configuration.backups: Creation complete after 1s

aws_s3_bucket_lifecycle_configuration.backups: Creating...
aws_s3_bucket_lifecycle_configuration.backups: Creation complete after 1s

aws_s3_bucket_public_access_block.backups: Creating...
aws_s3_bucket_public_access_block.backups: Creation complete after 1s

Apply complete! Resources: 5 added, 0 changed, 0 destroyed.
```

**5. Verify Deployment** ✅
```
Verifying S3 bucket...
✓ Bucket exists: valuecanvas-production-backups
✓ Versioning enabled
✓ Encryption enabled
✓ Public access blocked
✓ Lifecycle policies configured
```

---

### T+45:00 - Deployment Complete

**Workflow Summary**:
```
✓ Deploy to Production completed successfully
Duration: 4 minutes 30 seconds
Status: Success ✅

Resources Created:
- aws_s3_bucket.backups
- aws_s3_bucket_versioning.backups
- aws_s3_bucket_server_side_encryption_configuration.backups
- aws_s3_bucket_lifecycle_configuration.backups
- aws_s3_bucket_public_access_block.backups
```

---

### T+45:30 - Slack Notification

**Notification Posted**:

```
🚀 Deployment to Production

Status: ✅ Success
Commit: 67441e8
Author: @developer
PR: #123 - Add S3 bucket for automated backups

Changes:
• 5 resources created
• 0 resources changed
• 0 resources destroyed

Resources:
• S3 bucket: valuecanvas-production-backups
• Versioning enabled
• Encryption enabled
• Lifecycle policies configured

Duration: 4m 30s
```

---

## Post-Deployment

### T+60:00 - Verification

**Team verifies deployment**:

```bash
# Check bucket exists
aws s3 ls | grep valuecanvas-production-backups
# Output: valuecanvas-production-backups

# Check bucket configuration
aws s3api get-bucket-versioning --bucket valuecanvas-production-backups
# Output: "Status": "Enabled"

aws s3api get-bucket-encryption --bucket valuecanvas-production-backups
# Output: "SSEAlgorithm": "AES256"

aws s3api get-public-access-block --bucket valuecanvas-production-backups
# Output: All blocks enabled

aws s3api get-bucket-lifecycle-configuration --bucket valuecanvas-production-backups
# Output: 2 rules configured
```

**Result**: ✅ All configurations verified

---

### T+120:00 - First Backup

**Automated backup runs**:

```
Running database backup...
Uploading to s3://valuecanvas-production-backups/db-backup-2024-11-23.sql.gz
✓ Backup uploaded successfully
Size: 2.3 GB
```

**Verification**:
```bash
aws s3 ls s3://valuecanvas-production-backups/
# Output: db-backup-2024-11-23.sql.gz
```

**Result**: ✅ Backup system working

---

## Summary

### Timeline

| Time | Event | Status |
|------|-------|--------|
| T+0:00 | PR created | ✅ |
| T+0:05 | Workflow triggered | ✅ |
| T+2:10 | Workflow complete | ✅ |
| T+30:00 | Reviews complete | ✅ |
| T+40:00 | PR merged | ✅ |
| T+45:00 | Deployment complete | ✅ |
| T+120:00 | First backup | ✅ |

### Metrics

- **PR Review Time**: 30 minutes
- **Workflow Duration**: 2 minutes 10 seconds
- **Deployment Duration**: 4 minutes 30 seconds
- **Total Time to Production**: 45 minutes
- **Approvals Required**: 3
- **Resources Created**: 5
- **Cost**: ~$6/month

### What the Workflow Prevented

✅ **Format issues** - Caught automatically
✅ **Syntax errors** - Validated before merge
✅ **Unexpected changes** - Visible in plan
✅ **Destructive operations** - Would be highlighted
✅ **Security issues** - Reviewed by team

### Benefits Realized

✅ **Visibility** - Team saw exactly what would change
✅ **Collaboration** - Questions asked and answered
✅ **Safety** - Changes reviewed before deployment
✅ **Audit Trail** - All decisions documented
✅ **Confidence** - Team confident in changes

---

## Conclusion

The Terraform PR workflow successfully:

1. ✅ **Validated** infrastructure changes automatically
2. ✅ **Generated** detailed plan for review
3. ✅ **Posted** plan to PR for team visibility
4. ✅ **Enabled** collaborative review process
5. ✅ **Prevented** potential issues
6. ✅ **Deployed** safely to production
7. ✅ **Verified** deployment success

**Result**: Safe, reviewed, and documented infrastructure change deployed to production! 🎉

---

**Simulation Completed**: November 23, 2024
**Total Duration**: 2 hours (from PR to first backup)
**Status**: ✅ Successful deployment
**Resources**: 5 created, 0 destroyed

---

## Production Wiring Guide

*Source: `operations/deployment/production-wiring.md`*

## Overview

This document describes the production-ready wiring and configuration system for the ValueCanvas application. The system includes environment configuration, agent initialization, health checking, and application bootstrap.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Entry                        │
│                      (src/main.tsx)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Bootstrap System                           │
│                   (src/bootstrap.ts)                         │
│                                                              │
│  1. Load Environment Configuration                           │
│  2. Validate Configuration                                   │
│  3. Check Feature Flags                                      │
│  4. Initialize Monitoring                                    │
│  5. Initialize Agent Fabric                                  │
│  6. Check Database Connection                                │
│  7. Initialize Cache                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌────────────────┐ ┌──────────────┐ ┌──────────────┐
│  Environment   │ │    Agent     │ │   Services   │
│ Configuration  │ │ Initializer  │ │   (Various)  │
│                │ │              │ │              │
│ • Config Load  │ │ • Health     │ │ • Database   │
│ • Validation   │ │   Checks     │ │ • Cache      │
│ • Type Safety  │ │ • Retry      │ │ • Monitoring │
└────────────────┘ │   Logic      │ └──────────────┘
                   │ • Circuit    │
                   │   Breakers   │
                   └──────────────┘
```

## Components

### 1. Environment Configuration

**File**: `src/config/environment.ts`

**Purpose**: Centralized, type-safe environment configuration management.

**Features**:
- Type-safe configuration interface
- Environment variable loading with fallbacks
- Validation for production environments
- Feature flag management
- Singleton pattern for global access

**Usage**:
```typescript
import { getConfig, isProduction, isFeatureEnabled } from './config/environment';

const config = getConfig();
console.log(config.agents.apiUrl);

if (isProduction()) {
  // Production-specific logic
}

if (isFeatureEnabled('agentFabric')) {
  // Feature-specific logic
}
```

### 2. Agent Initializer

**File**: `src/services/AgentInitializer.ts`

**Purpose**: Production-ready agent health checking and initialization.

**Features**:
- Health checks for all 8 agents
- Retry logic with exponential backoff
- Circuit breaker integration
- Progress reporting
- Caching of health status

**Usage**:
```typescript
import { initializeAgents, getAgentHealth } from './services/AgentInitializer';

// Initialize with full health checks
const health = await initializeAgents({
  healthCheckTimeout: 5000,
  failFast: true,
  retryAttempts: 3,
  onProgress: (status) => console.log(status),
});

// Quick health check
const currentHealth = await getAgentHealth();
console.log(`${currentHealth.availableAgents}/${currentHealth.totalAgents} agents available`);
```

### 3. Bootstrap System

**File**: `src/bootstrap.ts`

**Purpose**: Orchestrates application initialization sequence.

**Features**:
- Multi-step initialization
- Error handling and recovery
- Progress reporting
- Environment-specific behavior
- Graceful degradation

**Usage**:
```typescript
import { bootstrap, bootstrapProduction } from './bootstrap';

// Standard bootstrap
const result = await bootstrap({
  skipAgentCheck: false,
  failFast: true,
  onProgress: (msg) => console.log(msg),
});

// Production bootstrap
const prodResult = await bootstrapProduction();
```

### 4. Agent API Service

**File**: `src/services/AgentAPI.ts`

**Purpose**: HTTP client for agent endpoints with circuit breaker protection.

**Features**:
- Circuit breaker per agent
- Request timeout handling
- Audit logging
- SDUI response validation
- WebSocket status streaming

**Updates**:
- Now reads configuration from environment
- Automatic circuit breaker setup
- Production-ready defaults

## Environment Variables

### Required for Production

```bash
# Application
VITE_APP_ENV=production
VITE_APP_URL=https://app.valuecanvas.com
VITE_API_BASE_URL=https://api.valuecanvas.com

# Agent Fabric
VITE_AGENT_API_URL=https://agents.valuecanvas.com/api/agents
# Mock routing is disabled in production. If you do not use a single base URL,
# ensure each agent is registered with an explicit endpoint before serving traffic.

# Database
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Security
VITE_HTTPS_ONLY=true
JWT_SECRET=your-jwt-secret-min-32-chars
```

### Optional but Recommended

```bash
# Monitoring
VITE_SENTRY_ENABLED=true
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project

# Vault
VAULT_ENABLED=true
VAULT_ADDR=https://vault.example.com:8200

# Caching
REDIS_ENABLED=true
REDIS_URL=redis://redis.internal:6379
```

## Configuration Files

### Development

**File**: `.env.local`

```bash
VITE_APP_ENV=development
VITE_MOCK_AGENTS=true
VITE_SDUI_DEBUG=true
LOG_LEVEL=debug
```

### Production

**File**: `.env.production`

```bash
VITE_APP_ENV=production
VITE_MOCK_AGENTS=false
VITE_SDUI_DEBUG=false
LOG_LEVEL=warn
VITE_HTTPS_ONLY=true
```

## Bootstrap Sequence

### 1. Load Configuration

```typescript
const config = getConfig();
```

- Reads environment variables
- Applies defaults
- Creates typed configuration object

### 2. Validate Configuration

```typescript
const errors = validateEnvironmentConfig(config);
```

- Checks required variables
- Validates URLs and formats
- Ensures production requirements

### 3. Check Feature Flags

```typescript
console.log('Features:', config.features);
```

- Logs enabled features
- Determines initialization path

### 4. Initialize Monitoring

```typescript
if (config.monitoring.sentry.enabled) {
  await initializeSentry(config.monitoring.sentry);
}
```

- Sets up error tracking
- Configures performance monitoring

### 5. Initialize Agent Fabric

```typescript
const agentHealth = await initializeAgents({
  healthCheckTimeout: 5000,
  failFast: isProduction(),
  retryAttempts: 3,
});
```

- Checks all 8 agents
- Retries failed checks
- Reports health status

### 6. Check Database

```typescript
await checkDatabaseConnection();
```

- Verifies Supabase connection
- Tests authentication

### 7. Initialize Cache

```typescript
if (config.cache.enabled) {
  await initializeCache(config.cache);
}
```

- Connects to Redis
- Verifies cache availability

## Health Checks

### Agent Health Check

Each agent is checked with a simple health query:

```typescript
const response = await agentAPI.query({
  agent: 'opportunity',
  query: 'health check',
  context: { metadata: { healthCheck: true } },
});
```

**Success Criteria**:
- Response received within timeout
- `response.success === true`
- No circuit breaker trips

**Retry Logic**:
- Max retries: 3
- Backoff: Exponential (1s, 2s, 4s)
- Retry on: Transient failures
- Skip on: Permanent failures

### Health Status

```typescript
interface AgentHealthStatus {
  agent: AgentType;
  available: boolean;
  responseTime?: number;
  error?: string;
  lastChecked: Date;
}
```

### System Health

```typescript
interface SystemHealth {
  healthy: boolean;
  agents: AgentHealthStatus[];
  totalAgents: number;
  availableAgents: number;
  unavailableAgents: number;
  averageResponseTime: number;
}
```

## Error Handling

### Configuration Errors

**Production**: Application fails to start
**Development**: Warnings logged, continues

```typescript
if (configErrors.length > 0 && isProduction()) {
  throw new Error('Invalid configuration');
}
```

### Agent Initialization Errors

**Production**: Application fails to start if `failFast: true`
**Development**: Warnings logged, continues with degraded functionality

```typescript
if (!agentHealth.healthy && failFast) {
  throw new Error('Agent Fabric not operational');
}
```

### Runtime Errors

All runtime errors are caught by error boundaries and reported to monitoring.

## Circuit Breakers

### Configuration

```typescript
{
  enabled: true,
  threshold: 5,      // Failures before opening
  cooldown: 60000,   // 60 seconds
}
```

### States

1. **CLOSED**: Normal operation
2. **OPEN**: Failures exceeded threshold, requests blocked
3. **HALF_OPEN**: Testing if service recovered

### Per-Agent Breakers

Each agent has its own circuit breaker:

```typescript
const breakers = {
  'opportunity': CircuitBreaker,
  'target': CircuitBreaker,
  'realization': CircuitBreaker,
  // ... etc
};
```

## Monitoring Integration

### Sentry

```typescript
if (config.monitoring.sentry.enabled) {
  Sentry.init({
    dsn: config.monitoring.sentry.dsn,
    environment: config.monitoring.sentry.environment,
    sampleRate: config.monitoring.sentry.sampleRate,
  });
}
```

### DataDog

```typescript
if (config.monitoring.datadog.enabled) {
  // Initialize DataDog APM
}
```

### Prometheus

```typescript
if (config.monitoring.prometheus.enabled) {
  // Expose metrics endpoint
}
```

## Feature Flags

### Available Flags

```typescript
features: {
  sduiDebug: boolean;        // SDUI debug mode
  agentFabric: boolean;      // Enable Agent Fabric
  workflow: boolean;         // Enable workflows
  compliance: boolean;       // Enable compliance
  multiTenant: boolean;      // Enable multi-tenancy
  usageTracking: boolean;    // Enable usage tracking
  billing: boolean;          // Enable billing
}
```

### Usage

```typescript
import { isFeatureEnabled } from './config/environment';

if (isFeatureEnabled('agentFabric')) {
  // Initialize agents
}

if (isFeatureEnabled('billing')) {
  // Initialize billing
}
```

## Deployment

### Local Development

```bash
# Copy environment file
cp .env.example .env.local

# Edit configuration
nano .env.local

# Start development server
npm run dev
```

### Production Build

```bash
# Copy production environment
cp .env.production.example .env.production

# Edit with production values
nano .env.production

# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Deployment

```dockerfile
# Build stage
FROM node:20.19.0-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_APP_ENV=production
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: valuecanvas-web
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: web
        image: valuecanvas/web:latest
        env:
        - name: VITE_APP_ENV
          value: "production"
        - name: VITE_AGENT_API_URL
          valueFrom:
            configMapKeyRef:
              name: valuecanvas-config
              key: agent-api-url
        - name: VITE_SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: valuecanvas-secrets
              key: supabase-url
```

## Testing

### Unit Tests

```typescript
import { loadEnvironmentConfig, validateEnvironmentConfig } from './config/environment';

describe('Environment Configuration', () => {
  it('should load configuration', () => {
    const config = loadEnvironmentConfig();
    expect(config).toBeDefined();
    expect(config.app.env).toBeDefined();
  });

  it('should validate production config', () => {
    const config = { /* ... */ };
    const errors = validateEnvironmentConfig(config);
    expect(errors).toHaveLength(0);
  });
});
```

### Integration Tests

```typescript
import { initializeAgents } from './services/AgentInitializer';

describe('Agent Initialization', () => {
  it('should check agent health', async () => {
    const health = await initializeAgents({
      healthCheckTimeout: 5000,
      failFast: false,
    });

    expect(health.totalAgents).toBe(8);
    expect(health.availableAgents).toBeGreaterThan(0);
  });
});
```

### E2E Tests

```typescript
import { bootstrap } from './bootstrap';

describe('Application Bootstrap', () => {
  it('should bootstrap successfully', async () => {
    const result = await bootstrap({
      skipAgentCheck: true,
      failFast: false,
    });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

## Troubleshooting

### Configuration Not Loading

**Problem**: Environment variables not being read

**Solution**:
1. Check file name (`.env.local` for development)
2. Restart development server
3. Verify Vite prefix (`VITE_` for client-side variables)

### Agent Health Checks Failing

**Problem**: All agents showing as unavailable

**Solution**:
1. Check `VITE_AGENT_API_URL` is correct
2. Verify agent service is running
3. Check network connectivity
4. Review circuit breaker status

### Bootstrap Timeout

**Problem**: Application hangs during bootstrap

**Solution**:
1. Increase `healthCheckTimeout`
2. Check agent service logs
3. Verify database connectivity
4. Review network latency

### Production Build Errors

**Problem**: Build fails with configuration errors

**Solution**:
1. Ensure all required variables are set
2. Check `.env.production` file exists
3. Verify variable names and values
4. Review build logs for specific errors

## Best Practices

### 1. Environment Variables

- ✅ Use `VITE_` prefix for client-side variables
- ✅ Never commit `.env.production` to version control
- ✅ Use secrets management (Vault, AWS Secrets Manager)
- ✅ Validate all required variables on startup

### 2. Health Checks

- ✅ Implement health check endpoints on all services
- ✅ Use appropriate timeouts (5-10 seconds)
- ✅ Retry transient failures
- ✅ Cache health status to reduce load

### 3. Error Handling

- ✅ Fail fast in production for critical errors
- ✅ Log all errors to monitoring service
- ✅ Provide user-friendly error messages
- ✅ Include error details in development

### 4. Monitoring

- ✅ Enable Sentry in production
- ✅ Set appropriate sample rates
- ✅ Tag errors with environment and version
- ✅ Set up alerts for critical errors

### 5. Feature Flags

- ✅ Use feature flags for gradual rollouts
- ✅ Test features in staging first
- ✅ Document flag dependencies
- ✅ Clean up unused flags

## Security Considerations

### 1. Secrets Management

- Never expose service role keys to client
- Use HashiCorp Vault in production
- Rotate secrets regularly
- Audit secret access

### 2. HTTPS

- Enforce HTTPS in production
- Use HSTS headers
- Validate SSL certificates
- Monitor certificate expiration

### 3. CORS

- Whitelist specific origins
- Don't use wildcards in production
- Validate origin headers
- Log CORS violations

### 4. Rate Limiting

- Implement per-user rate limits
- Use sliding window algorithm
- Return 429 status codes
- Log rate limit violations

## Performance Optimization

### 1. Bootstrap Time

- Parallelize health checks
- Cache configuration
- Lazy load non-critical services
- Use connection pooling

### 2. Agent Calls

- Enable circuit breakers
- Use request timeouts
- Implement caching
- Batch requests when possible

### 3. Bundle Size

- Code split by route
- Lazy load components
- Tree shake unused code
- Compress assets

## Maintenance

### Regular Tasks

- Review and update environment variables
- Check agent health metrics
- Monitor error rates
- Update dependencies
- Rotate secrets

### Quarterly Tasks

- Security audit
- Performance review
- Configuration cleanup
- Documentation updates

## Support

For issues or questions:

1. Check this documentation
2. Review application logs
3. Check monitoring dashboards
4. Contact DevOps team

## Changelog

### v1.0.0 (2025-11-18)

- Initial production wiring implementation
- Environment configuration system
- Agent initialization and health checking
- Bootstrap system with error handling
- Comprehensive documentation

---

## Terraform PR Workflow

*Source: `operations/deployment/terraform-pr-workflow.md`*

## Overview

The Terraform PR workflow automatically validates infrastructure changes and posts detailed plan summaries to Pull Requests, preventing infrastructure drift and surprises in production.

## Problem Statement

### Before Implementation

**Issue**: Terraform changes were applied directly to `main` without visibility into what would change.

**Risks**:
- 🚨 **Infrastructure drift** - Unexpected changes in production
- 💥 **Accidental destruction** - Resources deleted without warning
- 🤷 **No review process** - Changes applied without team visibility
- 🐛 **Syntax errors** - Invalid Terraform caught only during deployment

**Example scenario**: Developer updates EKS cluster configuration

**What happened**:
```
1. Push to main
2. Workflow runs terraform apply
3. ❌ Cluster gets destroyed and recreated
4. 💥 Production outage
5. 😱 Team finds out after the fact
```

### After Implementation

**Solution**: Automated Terraform validation and plan preview on every PR

**Benefits**:
- ✅ **Visibility** - See exactly what will change before merging
- ⚠️ **Warnings** - Destructive changes highlighted in PR
- 🔍 **Validation** - Syntax and format checked automatically
- 👥 **Team review** - Infrastructure changes reviewed like code

**Same scenario with new workflow**:

```
1. Create PR with EKS changes
2. Workflow runs terraform plan
3. ⚠️ PR comment shows: "Will destroy and recreate cluster"
4. 👥 Team reviews and discusses
5. ✅ Either approve or request changes
6. 🎯 Merge only when safe
```

---

## How It Works

### 1. Trigger

Workflow runs automatically on PRs that modify Terraform files:

```yaml
on:
  pull_request:
    paths:
      - 'infrastructure/terraform/**'
```

### 2. Validation Steps

The workflow performs four checks:

#### Step 1: Format Check
```bash
terraform fmt -check -recursive
```
**Purpose**: Ensure consistent formatting
**Fails if**: Files are not properly formatted
**Fix**: Run `terraform fmt -recursive`

#### Step 2: Initialize
```bash
terraform init -backend=false
```
**Purpose**: Download providers and modules
**Fails if**: Invalid provider configuration
**Fix**: Check provider versions and sources

#### Step 3: Validate
```bash
terraform validate
```
**Purpose**: Check syntax and configuration
**Fails if**: Invalid Terraform syntax
**Fix**: Review error messages and fix syntax

#### Step 4: Plan
```bash
terraform plan -no-color -out=tfplan
```
**Purpose**: Generate execution plan
**Fails if**: Invalid variables or resources
**Fix**: Check variable values and resource configuration

### 3. PR Comment

The workflow posts a detailed comment to the PR:

```markdown
## Terraform Plan Results 📋

**Environment**: `staging`
**Terraform Version**: `1.5.0`

### Validation Status

| Check | Status |
|-------|--------|
| Format | ✅ `terraform fmt` |
| Init | ✅ `terraform init` |
| Validate | ✅ `terraform validate` |
| Plan | ✅ `terraform plan` |

### Resource Changes

| Action | Count |
|--------|-------|
| 🟢 Create | 3 |
| 🟡 Update | 2 |
| 🔴 Destroy | 0 |

### Plan Output

<details>
<summary>Click to expand full plan</summary>

```terraform
[Full plan output here]
```

</details>
```

---

## Example Scenarios

### Scenario 1: Adding New Resources

**Change**: Add new S3 bucket for backups

**PR Comment**:
```markdown
### Resource Changes

| Action | Count |
|--------|-------|
| 🟢 Create | 1 |
| 🟡 Update | 0 |
| 🔴 Destroy | 0 |

Resources to create:
- `aws_s3_bucket.backups`
```

**Review**: ✅ Safe to merge

---

### Scenario 2: Updating Resources

**Change**: Increase RDS instance size

**PR Comment**:
```markdown
### Resource Changes

| Action | Count |
|--------|-------|
| 🟢 Create | 0 |
| 🟡 Update | 1 |
| 🔴 Destroy | 0 |

Resources to update:
- `aws_rds_instance.main` (instance_class: db.t3.medium → db.t3.large)
```

**Review**: ✅ Safe to merge (in-place update)

---

### Scenario 3: Destructive Changes

**Change**: Change EKS cluster name

**PR Comment**:
```markdown
### Resource Changes

| Action | Count |
|--------|-------|
| 🟢 Create | 1 |
| 🟡 Update | 0 |
| 🔴 Destroy | 1 |

### ⚠️ WARNING: Destructive Changes Detected

This plan will **destroy 1 resource(s)**. Please review carefully before merging.

Resources to destroy:
- `aws_eks_cluster.main`

Resources to create:
- `aws_eks_cluster.main` (with new name)
```

**Review**: ⚠️ Requires careful review and planning

---

### Scenario 4: Format Issues

**Change**: Add new variable without formatting

**PR Comment**:
```markdown
### Validation Status

| Check | Status |
|-------|--------|
| Format | ❌ `terraform fmt` |
| Init | ✅ `terraform init` |
| Validate | ✅ `terraform validate` |
| Plan | ✅ `terraform plan` |

❌ Terraform format check failed. Run 'terraform fmt -recursive' to fix.
```

**Review**: ❌ Must fix formatting before merge

---

### Scenario 5: Validation Errors

**Change**: Reference non-existent variable

**PR Comment**:
```markdown
### Validation Status

| Check | Status |
|-------|--------|
| Format | ✅ `terraform fmt` |
| Init | ✅ `terraform init` |
| Validate | ❌ `terraform validate` |
| Plan | ⏭️ Skipped |

Error: Reference to undeclared input variable

  on main.tf line 42:
  42:   instance_type = var.nonexistent_var
```

**Review**: ❌ Must fix validation errors before merge

---

## Usage

### For Developers

#### 1. Make Terraform Changes

```bash
# Edit Terraform files
vim infrastructure/terraform/main.tf

# Format your changes
cd infrastructure/terraform
terraform fmt -recursive
```

#### 2. Validate Locally (Optional)

```bash
# Run local validation
./scripts/terraform-validate.sh
```

**Output**:
```
✅ All validation checks passed!

Your Terraform configuration is ready to:
  • Create a Pull Request
  • Trigger automated plan in CI/CD
  • Be reviewed by the team
```

#### 3. Create Pull Request

```bash
git add infrastructure/terraform/
git commit -m "feat: add backup S3 bucket"
git push origin feature/add-backup-bucket

# Create PR on GitHub
gh pr create --title "Add backup S3 bucket" --body "Adds S3 bucket for automated backups"
```

#### 4. Review Workflow Results

The workflow will automatically:
1. Run validation checks
2. Generate Terraform plan
3. Post results as PR comment
4. Update comment if you push new commits

#### 5. Address Issues

If validation fails:

```bash
# Fix formatting
terraform fmt -recursive

# Fix validation errors
# (Review error messages in PR comment)

# Push fixes
git add .
git commit -m "fix: address validation errors"
git push
```

#### 6. Merge When Approved

Once the workflow passes and team approves:

```bash
# Merge PR
gh pr merge --squash
```

The production deployment workflow will then apply the changes.

---

### For Reviewers

#### Review Checklist

When reviewing Terraform PRs:

- [ ] **Validation Status**: All checks passed (✅)
- [ ] **Resource Changes**: Understand what will change
- [ ] **Destructive Changes**: None, or justified and planned
- [ ] **Security**: No hardcoded secrets or credentials
- [ ] **Naming**: Resources follow naming conventions
- [ ] **Tags**: Resources properly tagged
- [ ] **Documentation**: Changes documented if needed

#### Reviewing Destructive Changes

If PR includes destructive changes (🔴):

1. **Understand the impact**
   - What resources will be destroyed?
   - What depends on these resources?
   - Will there be downtime?

2. **Plan the deployment**
   - Schedule during maintenance window?
   - Need to backup data first?
   - Communication plan for stakeholders?

3. **Verify necessity**
   - Is destruction necessary?
   - Can we achieve the goal without destruction?
   - Are there alternatives?

4. **Approve only if**
   - Impact is understood and acceptable
   - Deployment is planned
   - Team is prepared

---

## Configuration

### Required Secrets

The workflow requires these GitHub secrets:

| Secret | Description | Example |
|--------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_KEY` | Supabase service key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `TOGETHER_API_KEY` | Together.ai API key | `xxx` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-xxx` |
| `JWT_SECRET` | JWT secret | `xxx` |
| `DB_PASSWORD` | Database password | `xxx` |
| `ACM_CERTIFICATE_ARN` | ACM certificate ARN | `arn:aws:acm:us-east-1:...` |

### Workflow Permissions

The workflow requires:

```yaml
permissions:
  contents: read        # Read repository contents
  pull-requests: write  # Post comments to PRs
```

---

## Troubleshooting

### Issue: Workflow doesn't run

**Symptom**: No workflow run when PR is created

**Diagnosis**:
1. Check if Terraform files were modified
2. Verify workflow file exists: `.github/workflows/terraform-check.yml`
3. Check workflow is enabled in repository settings

**Solution**:
```bash
# Verify path filter matches your changes
git diff --name-only origin/main | grep "infrastructure/terraform"
```

---

### Issue: Format check fails

**Symptom**: ❌ `terraform fmt` check fails

**Diagnosis**: Files are not properly formatted

**Solution**:
```bash
cd infrastructure/terraform
terraform fmt -recursive
git add .
git commit -m "fix: format Terraform files"
git push
```

---

### Issue: Validation fails

**Symptom**: ❌ `terraform validate` fails

**Diagnosis**: Invalid Terraform syntax or configuration

**Solution**:
1. Review error message in PR comment
2. Fix the syntax error
3. Test locally:
   ```bash
   cd infrastructure/terraform
   terraform init -backend=false
   terraform validate
   ```
4. Push fix

---

### Issue: Plan fails

**Symptom**: ❌ `terraform plan` fails

**Diagnosis**: Invalid variables or resource configuration

**Common causes**:
- Missing required variables
- Invalid variable values
- Resource dependencies not met
- AWS permissions issues

**Solution**:
1. Review error in PR comment
2. Check variable values
3. Verify AWS credentials have required permissions
4. Test locally with same variables

---

### Issue: Comment not posted

**Symptom**: Workflow runs but no PR comment

**Diagnosis**: Missing permissions or GitHub API issue

**Solution**:
1. Verify workflow has `pull-requests: write` permission
2. Check workflow logs for errors
3. Verify GitHub token has required scopes

---

### Issue: Plan too large

**Symptom**: PR comment truncated

**Diagnosis**: Plan output exceeds GitHub comment size limit (65KB)

**Solution**:
- Comment will be automatically truncated
- Full plan available in workflow artifacts
- Download artifact from workflow run

---

## Best Practices

### 1. Always Format Before Committing

```bash
# Add to pre-commit hook
cd infrastructure/terraform && terraform fmt -recursive
```

### 2. Validate Locally First

```bash
# Run validation script
./scripts/terraform-validate.sh
```

### 3. Small, Focused Changes

- One logical change per PR
- Easier to review
- Faster to merge
- Lower risk

### 4. Descriptive Commit Messages

```bash
# Good
git commit -m "feat: add S3 bucket for backups with lifecycle policy"

# Bad
git commit -m "update terraform"
```

### 5. Document Destructive Changes

If PR includes destructive changes:

```markdown
## ⚠️ Destructive Changes

This PR will destroy and recreate the EKS cluster to change the name.

**Impact**:
- ~5 minutes downtime
- All pods will be rescheduled

**Mitigation**:
- Deploy during maintenance window (Sunday 2 AM)
- Notify team 24 hours in advance
- Have rollback plan ready
```

### 6. Review Plan Carefully

Don't just check if workflow passed - actually review the plan:

- What resources are changing?
- Are the changes expected?
- Any surprises?
- Any security implications?

---

## Advanced Features

### Custom Plan Parsing

The workflow includes a plan parser (`scripts/parse-terraform-plan.js`) that:

- Extracts resource changes
- Counts creates/updates/destroys
- Highlights destructive changes
- Generates formatted summary

### Plan Artifacts

Every workflow run uploads plan artifacts:

- `tfplan` - Binary plan file
- `plan_output.txt` - Text plan output

**Download artifacts**:
1. Go to workflow run
2. Scroll to "Artifacts" section
3. Download `terraform-plan`

### Comment Updates

The workflow updates the same comment on subsequent pushes:

- First push: Creates new comment
- Subsequent pushes: Updates existing comment
- Keeps PR clean with single comment

---

## Integration with Deployment

### Workflow Relationship

```
PR Created
    ↓
terraform-check.yml runs
    ↓ (validates and plans)
PR Comment posted
    ↓
Team reviews
    ↓
PR Merged
    ↓
deploy-production.yml runs
    ↓ (applies changes)
Infrastructure Updated
```

### Deployment Safety

The PR workflow ensures:

1. **Validation before merge** - No invalid Terraform reaches main
2. **Visibility before apply** - Team sees changes before deployment
3. **Review process** - Infrastructure changes reviewed like code
4. **Audit trail** - All changes documented in PRs

---

## Metrics and Monitoring

### Success Metrics

Track these metrics to measure workflow effectiveness:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| PRs with Terraform changes | 100% validated | GitHub Actions insights |
| Format failures | < 5% | Workflow run history |
| Validation failures | < 10% | Workflow run history |
| Destructive changes caught | 100% | PR comment analysis |
| Infrastructure incidents | Reduced | Incident tracking |

### Monitoring

Monitor workflow health:

```bash
# View recent workflow runs
gh run list --workflow=terraform-check.yml --limit 10

# View specific run
gh run view <run-id>

# Download logs
gh run download <run-id>
```

---

## Future Enhancements

### 1. Cost Estimation

Add cost estimation to PR comments:

```yaml
- name: Run Infracost
  uses: infracost/actions/comment@v1
  with:
    path: infrastructure/terraform
```

**Benefit**: See cost impact before merging

### 2. Security Scanning

Add security scanning with tfsec:

```yaml
- name: Run tfsec
  uses: aquasecurity/tfsec-action@v1
  with:
    working_directory: infrastructure/terraform
```

**Benefit**: Catch security issues early

### 3. Compliance Checking

Add compliance checking with Checkov:

```yaml
- name: Run Checkov
  uses: bridgecrewio/checkov-action@master
  with:
    directory: infrastructure/terraform
```

**Benefit**: Ensure compliance with policies

---

## References

- **Workflow file**: `.github/workflows/terraform-check.yml`
- **Validation script**: `scripts/terraform-validate.sh`
- **Plan parser**: `scripts/parse-terraform-plan.js`
- **Test script**: `scripts/test-terraform-workflow.sh`
- **Terraform docs**: https://www.terraform.io/docs

---

**Last Updated**: November 23, 2024
**Version**: 1.0
**Author**: ValueCanvas DevOps Team

---

## Docker Desktop Port Forwarding Fix

*Source: `operations/deployment/DOCKER_PORT_FORWARDING_FIX.md`*

**Issue:** Caddy/App running in Docker but not accessible from Windows browser
**Environment:** WSL2 + Docker Desktop + Windows

---

## 🔍 Problem Analysis

You have:
- ✅ Caddy container running and healthy
- ✅ App container running on port 5173
- ✅ Internal proxying working (Caddy → App)
- ❌ Port forwarding from Docker to Windows not working

**Root Cause:** Docker Desktop port forwarding issue between WSL2 and Windows

---

## ✅ Solution 1: Fix Port Mapping (Recommended)

### Update infra/docker/docker-compose.dev.yml

The current configuration has the app on port 5173, but your vite.config.ts is set to port 3000. Let's align them:

```yaml
services:
  app:
    ports:
      - "3000:3000"      # Changed from 5173:5173
      - "24678:24678"    # HMR port
    environment:
      - VITE_PORT=3000   # Changed from 5173
```

### Add Caddy Service

```yaml
  caddy:
    image: caddy:2-alpine
    container_name: valuecanvas-caddy
    ports:
      - "80:80"          # HTTP
      - "443:443"        # HTTPS
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    networks:
      - valuecanvas-network
    restart: unless-stopped
    depends_on:
      - app
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  caddy-data:
  caddy-config:
```

### Create Caddyfile

```caddyfile
# Caddyfile for local development
{
    # Disable automatic HTTPS for localhost
    auto_https off
    # Enable admin API
    admin localhost:2019
}

# Main site
:80 {
    # Reverse proxy to Vite dev server
    reverse_proxy app:5173 {
        # Health check
        health_uri /health
        health_interval 10s
        health_timeout 5s
    }

    # Enable compression
    encode gzip

    # Security headers
    header {
        # XSS Protection
        X-XSS-Protection "1; mode=block"
        # Prevent MIME sniffing
        X-Content-Type-Options "nosniff"
        # Clickjacking protection
        X-Frame-Options "SAMEORIGIN"
        # Remove server header
        -Server
    }

    # Logging
    log {
        output stdout
        format json
    }
}

# Health check endpoint
:80/health {
    respond "healthy" 200
}
```

---

## ✅ Solution 2: Docker Desktop Settings

### 1. Restart Docker Desktop

```powershell
# In PowerShell (as Administrator)
Restart-Service docker
```

Or manually:
1. Right-click Docker Desktop tray icon
2. Select "Restart"
3. Wait for Docker to fully restart

### 2. Check WSL Integration

1. Open Docker Desktop
2. Go to **Settings** → **Resources** → **WSL Integration**
3. Ensure your WSL2 distro is enabled
4. Click **Apply & Restart**

### 3. Verify Port Forwarding

```powershell
# In PowerShell, check if ports are listening
netstat -ano | findstr ":80"
netstat -ano | findstr ":3000"
```

---

## ✅ Solution 3: Windows Firewall

### Allow Docker Desktop

```powershell
# In PowerShell (as Administrator)
New-NetFirewallRule -DisplayName "Docker Desktop" -Direction Inbound -Program "C:\Program Files\Docker\Docker\Docker Desktop.exe" -Action Allow

# Allow specific ports
New-NetFirewallRule -DisplayName "Docker Port 80" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Docker Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

---

## ✅ Solution 4: Use localhost/service DNS

### Update Caddyfile

```caddyfile
:80 {
    # Use localhost or a compose service DNS name to access the app
    reverse_proxy localhost:3000
}
```

### Update docker-compose.yml

```yaml
services:
  app:
    depends_on:
      - backend
    environment:
      APP_UPSTREAM: http://backend:3000
```

---

## ✅ Solution 5: Network Mode Host (Linux Only)

**Note:** This only works on Linux, not Windows/Mac

```yaml
services:
  app:
    network_mode: "host"
    # Remove ports section when using host mode
```

---

## 🧪 Testing

### From WSL2

```bash
# Test app directly
curl http://localhost:3000

# Test Caddy
curl http://localhost:80

# Test health endpoint
curl http://localhost:80/health
```

### From Windows

```powershell
# Test in PowerShell
Invoke-WebRequest -Uri http://localhost
Invoke-WebRequest -Uri http://localhost:3000

# Or in browser
# http://localhost
# http://localhost:3000
```

### Docker Logs

```bash
# Check Caddy logs
docker logs valuecanvas-caddy

# Check app logs
docker logs valuecanvas-dev

# Follow logs
docker logs -f valuecanvas-caddy
```

---

## 🔧 Complete Setup Script

Create `scripts/docker-setup.sh`:

```bash
#!/bin/bash

echo "🐳 Setting up Docker environment..."

# 1. Stop existing containers
docker-compose down

# 2. Create secrets directory
mkdir -p secrets
openssl rand -base64 32 > secrets/dev_db_password.txt
openssl rand -base64 32 > secrets/dev_redis_password.txt

# 3. Create Caddyfile
cat > Caddyfile << 'EOF'
{
    auto_https off
    admin localhost:2019
}

:80 {
    reverse_proxy app:5173
    encode gzip
    header {
        X-XSS-Protection "1; mode=block"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        -Server
    }
    log {
        output stdout
        format json
    }
}

:80/health {
    respond "healthy" 200
}
EOF

# 4. Start services
docker-compose up -d

# 5. Wait for services
echo "⏳ Waiting for services to start..."
sleep 10

# 6. Test connectivity
echo "🧪 Testing connectivity..."
curl -f http://localhost:80/health && echo "✅ Caddy is healthy" || echo "❌ Caddy not accessible"
curl -f http://localhost:3000 && echo "✅ App is accessible" || echo "❌ App not accessible"

echo "✅ Setup complete!"
echo "Access your app at: http://localhost"
```

---

## 🐛 Troubleshooting

### Issue: "Connection refused"

**Check if containers are running:**
```bash
docker ps
```

**Check if ports are bound:**
```bash
docker port valuecanvas-caddy
docker port valuecanvas-dev
```

**Check container logs:**
```bash
docker logs valuecanvas-caddy
docker logs valuecanvas-dev
```

### Issue: "Port already in use"

**Find what's using the port:**
```bash
# On WSL2
lsof -i :80
lsof -i :3000

# On Windows (PowerShell)
netstat -ano | findstr ":80"
```

**Kill the process:**
```bash
# On WSL2
kill -9 <PID>

# On Windows (PowerShell as Admin)
Stop-Process -Id <PID> -Force
```

### Issue: "Cannot connect from Windows"

**1. Check Docker Desktop is running**
```powershell
docker version
```

**2. Restart Docker Desktop**
- Right-click tray icon → Restart

**3. Check WSL2 integration**
- Docker Desktop → Settings → Resources → WSL Integration

**4. Test from WSL2 first**
```bash
curl http://localhost:80
```

**5. If WSL2 works but Windows doesn't:**
```powershell
# Restart WSL
wsl --shutdown
# Then restart Docker Desktop
```

---

## 📊 Port Reference

| Service | Container Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| Caddy | 80 | 80 | HTTP |
| Caddy | 443 | 443 | HTTPS |
| Caddy Admin | 2019 | - | Admin API |
| App (Vite) | 3000 | 3000 | Dev Server |
| App (HMR) | 24678 | 24678 | Hot Reload |
| PostgreSQL | 5432 | 5432 | Database |
| Redis | 6379 | 6379 | Cache |

---

## 🚀 Quick Commands

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# Restart Caddy
docker-compose restart caddy

# View logs
docker-compose logs -f

# Rebuild and restart
docker-compose up -d --build

# Check health
docker-compose ps
```

---

## 📚 Additional Resources

- [Docker Desktop WSL2 Backend](https://docs.docker.com/desktop/windows/wsl/)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [Docker Compose Networking](https://docs.docker.com/compose/networking/)

---

**Last Updated:** 2025-12-06
**Status:** Ready for deployment

---

## Postgres Connection Safeguards (Pooling, Timeouts, Retries, Circuit Breakers)

*Source: `operations/deployment/postgres-connection-safeguards.md`*

## Environment Configuration (Defaults)

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_POOL_MAX` | `10` | Max pooled connections per process. |
| `DATABASE_POOL_MIN` | `0` | Min idle connections to keep warm. |
| `DATABASE_POOL_IDLE_TIMEOUT_SECONDS` | `20` | Close idle connections after N seconds. |
| `DATABASE_CONNECT_TIMEOUT_SECONDS` | `10` | TCP/handshake timeout for new connections. |
| `DATABASE_STATEMENT_TIMEOUT_MS` | `30000` | Server-side statement timeout applied per connection. |
| `DATABASE_REQUEST_TIMEOUT_MS` | `15000` | App-level timeout for each request. |
| `DATABASE_RETRY_MAX_ATTEMPTS` | `3` | Max attempts for transient failures. |
| `DATABASE_RETRY_BASE_DELAY_MS` | `100` | Base delay for exponential backoff. |
| `DATABASE_RETRY_MAX_DELAY_MS` | `2000` | Upper bound for retry backoff. |
| `DATABASE_RETRY_JITTER_MS` | `100` | Added random jitter to spread retries. |
| `DATABASE_CIRCUIT_BREAKER_ENABLED` | `true` | Enables circuit breaker protection. |
| `DATABASE_CIRCUIT_BREAKER_FAILURE_THRESHOLD` | `5` | Failures to open circuit. |
| `DATABASE_CIRCUIT_BREAKER_RESET_TIMEOUT_MS` | `30000` | Wait time before half-open probes. |
| `DATABASE_CIRCUIT_BREAKER_HALF_OPEN_MAX` | `2` | Max in-flight probes when half-open. |

## Retry and Idempotency Policy

- Retries are **only** allowed on transient Postgres errors (serialization failures, connection blips, etc.).
- **Never retry non-idempotent writes** unless an idempotency key is present.
- Reads and idempotent writes can retry with exponential backoff + jitter.

## Circuit Breaker + Bulkhead Guidance

- Circuit breaker protects the database during sustained failures by stopping retries and rejecting new traffic.
- For bulkheads, isolate read/write pools (or per-tenant pools) and cap per-request concurrency, especially for background jobs.
- Consider separate pool sizes for request traffic vs. async workers to avoid head-of-line blocking.

## Deployment Notes

### Containers / Long-lived Servers

- Keep a **moderate pool** (5-20 connections per instance) and use `DATABASE_POOL_MIN` > 0 to reduce cold-start latency.
- Tune `DATABASE_STATEMENT_TIMEOUT_MS` for your SLOs and protect against runaway queries.
- Enable circuit breaker to reduce cascading failures under partial outages.

### Serverless / Short-lived Runtimes

- Keep pools **small** (`DATABASE_POOL_MAX=1-3`, `DATABASE_POOL_MIN=0`) to avoid exhausting shared DB limits.
- Prefer a PgBouncer or managed pooling layer if the platform spins up many instances.
- Set lower request timeouts (e.g., 5-10s) to align with runtime execution limits.

---

## Database Migration Instructions

*Source: `operations/deployment/db-push-instructions.md`*

## 🚀 Push Migrations to Supabase Cloud

### Option 1: Via Supabase Studio SQL Editor (Recommended)

1. **Open Supabase Studio**:
   - Go to https://supabase.com/dashboard/project/bxaiabnqalurloblfwua/sql/new

2. **Execute migrations in order**:

   **Migration 1 - Baseline Schema** (648 lines):
   ```bash
   cat supabase/migrations/20250101000000_baseline_schema.sql
   ```
   - Copy the entire output
   - Paste into SQL Editor
   - Click "Run"

   **Migration 2 - Initial Schema** (433 lines):
   ```bash
   cat supabase/migrations/20251201120000_initial_schema.sql
   ```
   - Copy the entire output
   - Paste into SQL Editor
   - Click "Run"

   **Migration 3 - Target Agent Tables** (130 lines):
   ```bash
   cat supabase/migrations/20251201130000_align_target_agent_tables.sql
   ```
   - Copy the entire output
   - Paste into SQL Editor
   - Click "Run"

### Option 2: Via Supabase CLI (If installed)

```bash
# Link to your project
supabase link --project-ref bxaiabnqalurloblfwua

# Push all migrations
supabase db push
```

### Option 3: Combined Single File

Run this command to create a combined migration file:

```bash
cat supabase/migrations/20250101000000_baseline_schema.sql \
    supabase/migrations/20251201120000_initial_schema.sql \
    supabase/migrations/20251201130000_align_target_agent_tables.sql \
    > combined_migration.sql
```

Then execute `combined_migration.sql` in Supabase Studio.

---

## ✅ Verify Migrations

After running migrations, verify in Supabase Studio:

1. **Table Editor** → Check that tables exist:
   - `users`
   - `organizations`
   - `value_cases`
   - `business_objectives`
   - `value_trees`
   - `roi_models`
   - etc.

2. **SQL Editor** → Run:
   ```sql
   SELECT tablename FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY tablename;
   ```

3. **Authentication** → Settings → Enable Email Auth if not already enabled

---

## 🔧 Troubleshooting

### Error: "relation already exists"
- Some tables may already exist. This is OK.
- The migrations use `CREATE TABLE IF NOT EXISTS`

### Error: "permission denied"
- Make sure you're using the service role key in SQL Editor
- Or run as the postgres user

### Error: "function already exists"
- Functions may exist from previous attempts
- Use `DROP FUNCTION IF EXISTS function_name CASCADE;` before recreating

---

## 📋 Post-Migration Steps

1. **Disable Email Confirmation** (for testing):
   - Authentication → Settings
   - Uncheck "Enable email confirmations"
   - Save

2. **Test Signup**:
   - Go to http://localhost:5173
   - Try creating an account
   - Should succeed without email confirmation

3. **Check RLS Policies**:
   ```sql
   SELECT tablename, policyname, cmd, qual
   FROM pg_policies
   WHERE schemaname = 'public';
   ```

---

## ValueOS Observability Stack

*Source: `operations/deployment/OBSERVABILITY_STACK.md`*

**Goal**: Full visibility into application performance and health
**Stack**: OpenTelemetry + Prometheus + Grafana + CloudWatch
**Status**: Design Complete

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Application                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Frontend │  │ Backend  │  │ Database │                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       │             │              │                         │
│       └─────────────┴──────────────┘                         │
│                     │                                        │
│              OpenTelemetry SDK                               │
│                     │                                        │
└─────────────────────┼──────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐   ┌───▼────┐   ┌───▼────┐
   │ Metrics │   │  Logs  │   │ Traces │
   │Prometheus│  │CloudWatch│ │ Tempo  │
   └────┬────┘   └───┬────┘   └───┬────┘
        │            │            │
        └────────────┼────────────┘
                     │
              ┌──────▼──────┐
              │   Grafana   │
              │  Dashboards │
              └─────────────┘
```

---

## 1. OpenTelemetry Integration

### Backend (Node.js)

**Installation**:
```bash
npm install @opentelemetry/sdk-node \
            @opentelemetry/auto-instrumentations-node \
            @opentelemetry/exporter-prometheus \
            @opentelemetry/exporter-trace-otlp-http
```

**Configuration** (`src/observability/tracing.ts`):
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'valueos-backend',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),

  // Metrics
  metricReader: new PrometheusExporter({
    port: 9464,
    endpoint: '/metrics',
  }),

  // Traces
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),

  // Auto-instrumentation
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Too noisy
      },
    }),
  ],
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

export default sdk;
```

**Usage in Express**:
```typescript
import express from 'express';
import { trace, context } from '@opentelemetry/api';

const app = express();
const tracer = trace.getTracer('valueos-backend');

app.get('/api/users', async (req, res) => {
  const span = tracer.startSpan('get-users');

  try {
    // Add custom attributes
    span.setAttribute('user.id', req.user?.id);
    span.setAttribute('request.path', req.path);

    const users = await getUsers();

    span.setStatus({ code: SpanStatusCode.OK });
    res.json(users);
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});
```

### Frontend (React)

**Installation**:
```bash
npm install @opentelemetry/api \
            @opentelemetry/sdk-trace-web \
            @opentelemetry/instrumentation-fetch \
            @opentelemetry/instrumentation-xml-http-request \
            @opentelemetry/exporter-trace-otlp-http
```

**Configuration** (`src/observability/tracing.ts`):
```typescript
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const provider = new WebTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'valueos-frontend',
    [SemanticResourceAttributes.SERVICE_VERSION]: import.meta.env.VITE_APP_VERSION || '1.0.0',
  }),
});

const exporter = new OTLPTraceExporter({
  url: import.meta.env.VITE_OTEL_EXPORTER_URL || 'http://localhost:4318/v1/traces',
});

provider.addSpanProcessor(new BatchSpanProcessor(exporter));
provider.register();

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      propagateTraceHeaderCorsUrls: [
        /^https:\/\/api\.valueos\.com\/.*/,
      ],
    }),
    new XMLHttpRequestInstrumentation(),
  ],
});

export default provider;
```

---

## 2. Metrics (Prometheus)

### Prometheus Configuration

**`prometheus.yml`**:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'valueos-production'
    environment: 'production'

scrape_configs:
  # Backend metrics
  - job_name: 'valueos-backend'
    ec2_sd_configs:
      - region: us-east-1
        port: 9464
        filters:
          - name: tag:Service
            values: ['valueos-backend']
    relabel_configs:
      - source_labels: [__meta_ec2_tag_Environment]
        target_label: environment
      - source_labels: [__meta_ec2_instance_id]
        target_label: instance

  # Node exporter (system metrics)
  - job_name: 'node-exporter'
    ec2_sd_configs:
      - region: us-east-1
        port: 9100
        filters:
          - name: tag:Monitoring
            values: ['enabled']

  # AWS CloudWatch metrics
  - job_name: 'cloudwatch'
    static_configs:
      - targets: ['cloudwatch-exporter:9106']

# Alerting rules
rule_files:
  - 'alerts.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

### Alert Rules

**`alerts.yml`**:
```yaml
groups:
  - name: application
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"

      # High response time
      - alert: HighResponseTime
        expr: |
          histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "P95 response time is {{ $value }}s (threshold: 2s)"

      # Low availability
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service is down"
          description: "{{ $labels.job }} has been down for more than 1 minute"

  - name: infrastructure
    interval: 30s
    rules:
      # High CPU
      - alert: HighCPU
        expr: |
          100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value }}% (threshold: 80%)"

      # High memory
      - alert: HighMemory
        expr: |
          (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}% (threshold: 90%)"

      # Disk space
      - alert: LowDiskSpace
        expr: |
          (node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100 < 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space"
          description: "Disk space is {{ $value }}% available (threshold: 10%)"
```

---

## 3. Dashboards (Grafana)

### Dashboard Configuration

**System Overview Dashboard**:
```json
{
  "dashboard": {
    "title": "ValueOS System Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ]
      },
      {
        "title": "Response Time (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95"
          }
        ]
      },
      {
        "title": "Active Connections",
        "targets": [
          {
            "expr": "sum(nodejs_active_handles_total)",
            "legendFormat": "Active Handles"
          }
        ]
      }
    ]
  }
}
```

### Key Dashboards

1. **System Overview**
   - Request rate, error rate, response time
   - CPU, memory, disk usage
   - Active connections, database queries

2. **Application Performance**
   - Endpoint latency breakdown
   - Database query performance
   - Cache hit rate
   - External API calls

3. **Business Metrics**
   - Active users
   - API calls per endpoint
   - Feature usage
   - Conversion rates

4. **Infrastructure**
   - ECS task health
   - RDS performance
   - ElastiCache metrics
   - Load balancer metrics

---

## 4. Logging (CloudWatch)

### Structured Logging

**Backend** (`src/lib/logger.ts`):
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'valueos-backend',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.CloudWatch({
      logGroupName: '/ecs/valueos-backend',
      logStreamName: process.env.ECS_TASK_ID,
      awsRegion: 'us-east-1',
    }),
  ],
});

export default logger;
```

**Usage**:
```typescript
import logger from './lib/logger';

// Info
logger.info('User logged in', {
  userId: user.id,
  email: user.email,
  ip: req.ip,
});

// Error
logger.error('Database query failed', {
  error: error.message,
  stack: error.stack,
  query: query,
});

// With trace context
import { trace } from '@opentelemetry/api';

const span = trace.getActiveSpan();
logger.info('Processing request', {
  traceId: span?.spanContext().traceId,
  spanId: span?.spanContext().spanId,
});
```

---

## 5. Distributed Tracing (Tempo)

### Tempo Configuration

**`tempo.yaml`**:
```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: 0.0.0.0:4318
        grpc:
          endpoint: 0.0.0.0:4317

ingester:
  trace_idle_period: 10s
  max_block_bytes: 1_000_000
  max_block_duration: 5m

compactor:
  compaction:
    block_retention: 168h  # 7 days

storage:
  trace:
    backend: s3
    s3:
      bucket: valueos-traces
      region: us-east-1
```

### Trace Visualization

**Grafana Tempo Integration**:
```yaml
apiVersion: 1
datasources:
  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    jsonData:
      tracesToLogs:
        datasourceUid: 'loki'
        tags: ['traceId']
      serviceMap:
        datasourceUid: 'prometheus'
```

---

## 6. Deployment

### Docker Compose (Local)

**`infra/docker/docker-compose.observability.yml`**:
```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alerts.yml:/etc/prometheus/alerts.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources

  tempo:
    image: grafana/tempo:latest
    ports:
      - "3200:3200"
      - "4317:4317"
      - "4318:4318"
    volumes:
      - ./tempo.yaml:/etc/tempo.yaml
      - tempo-data:/var/tempo
    command: ["-config.file=/etc/tempo.yaml"]

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - loki-data:/loki

volumes:
  prometheus-data:
  grafana-data:
  tempo-data:
  loki-data:
```

### ECS Task Definition

**Sidecar Pattern**:
```json
{
  "family": "valueos-backend",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "valueos-backend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "OTEL_EXPORTER_OTLP_ENDPOINT",
          "value": "http://localhost:4318"
        }
      ]
    },
    {
      "name": "otel-collector",
      "image": "otel/opentelemetry-collector:latest",
      "portMappings": [
        {
          "containerPort": 4318,
          "protocol": "tcp"
        }
      ]
    }
  ]
}
```

---

## 7. Quick Start

### Local Development

```bash
# Start observability stack
docker-compose -f infra/docker/docker-compose.observability.yml up -d

# Access dashboards
open http://localhost:3001  # Grafana (admin/admin)
open http://localhost:9090  # Prometheus
```

### Production

```bash
# Deploy with Terraform
cd infra/terraform-new/modules/monitoring
terraform init
terraform apply

# Access dashboards
open https://grafana.valueos.com
```

---

## 8. Best Practices

1. **Sampling**: Use head-based sampling (10%) in production to reduce costs
2. **Cardinality**: Limit high-cardinality labels (user IDs, request IDs)
3. **Retention**: Keep traces for 7 days, metrics for 30 days
4. **Alerts**: Alert on symptoms, not causes
5. **Dashboards**: Create role-specific dashboards (dev, ops, business)

---

**Status**: Design Complete ✅
**Next**: Implementation
**Owner**: DevOps Team

---
Use the runbook for operational decisions and execution.
