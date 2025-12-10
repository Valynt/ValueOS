# Quick Reference: Pre-Production Deployment

## 🚀 Quick Start

```bash
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
