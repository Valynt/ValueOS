# Phase 2: Security & Permissions - Test Guide

**Date**: January 5, 2026  
**Status**: Ready for Testing

---

## Test Overview

Phase 2 implements 3 critical security features:
1. RLS Policy Validation (cross-tenant access prevention)
2. Password Policy Integration (DB → Frontend)
3. Audit Log Trigger (configuration change tracking)

---

## Test 1: RLS Policy Validation

### Objective
Verify that users from Tenant A cannot access settings from Tenant B

### Test File
`supabase/tests/database/settings_rls_cross_tenant.test.sql`

### How to Run

```bash
# Using pg_prove (recommended)
pg_prove -d $DATABASE_URL supabase/tests/database/settings_rls_cross_tenant.test.sql

# Or using psql
psql $DATABASE_URL < supabase/tests/database/settings_rls_cross_tenant.test.sql
```

### Expected Results

```
1..12
ok 1 - User A can access Tenant A organization configurations
ok 2 - User A CANNOT access Tenant B organization configurations (RLS blocks)
ok 3 - User B can access Tenant B organization configurations
ok 4 - User B CANNOT access Tenant A organization configurations (RLS blocks)
ok 5 - User A can UPDATE Tenant A configurations
ok 6 - User A CANNOT UPDATE Tenant B configurations (RLS blocks, value unchanged)
ok 7 - User A can access their own user preferences
ok 8 - User A CANNOT access User B preferences (RLS blocks)
ok 9 - User A can access Team A settings
ok 10 - User A CANNOT access Team B settings (RLS blocks)
ok 11 - Service role can access all configurations
ok 12 - RLS is enabled on all settings tables
```

### Manual Verification

```sql
-- 1. Create two test tenants
INSERT INTO organizations (id, name) VALUES
  ('tenant-a-id', 'Tenant A'),
  ('tenant-b-id', 'Tenant B');

-- 2. Create two test users
INSERT INTO auth.users (id, email) VALUES
  ('user-a-id', 'user-a@tenant-a.com'),
  ('user-b-id', 'user-b@tenant-b.com');

-- 3. Link users to tenants
INSERT INTO user_tenants (user_id, tenant_id, role, status) VALUES
  ('user-a-id', 'tenant-a-id', 'admin', 'active'),
  ('user-b-id', 'tenant-b-id', 'admin', 'active');

-- 4. Try to access cross-tenant (should fail)
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "user-a-id"}';

-- This should return 0 rows (RLS blocks access)
SELECT COUNT(*) FROM organization_configurations
WHERE organization_id = 'tenant-b-id';
```

### Success Criteria
- ✅ All 12 tests pass
- ✅ Cross-tenant access returns 0 rows
- ✅ Same-tenant access returns expected rows
- ✅ Service role can access all tenants

---

## Test 2: Password Policy Integration

### Objective
Verify password validation uses organization's password policy from database

### Test File
`src/hooks/usePasswordPolicy.ts`

### Setup Test Data

```sql
-- Set strict password policy for Tenant A
UPDATE organization_configurations
SET auth_policy = jsonb_set(
  auth_policy,
  '{passwordPolicy}',
  '{
    "minLength": 16,
    "requireUppercase": true,
    "requireLowercase": true,
    "requireNumbers": true,
    "requireSpecialChars": true
  }'::jsonb
)
WHERE organization_id = 'tenant-a-id';

-- Set lenient password policy for Tenant B
UPDATE organization_configurations
SET auth_policy = jsonb_set(
  auth_policy,
  '{passwordPolicy}',
  '{
    "minLength": 8,
    "requireUppercase": false,
    "requireLowercase": true,
    "requireNumbers": false,
    "requireSpecialChars": false
  }'::jsonb
)
WHERE organization_id = 'tenant-b-id';
```

### Manual Test (Browser Console)

```typescript
// Test with Tenant A (strict policy)
const { validatePassword } = usePasswordPolicy('tenant-a-id');

// Should FAIL (too short)
const result1 = validatePassword('Short1!');
console.log(result1.isValid); // false
console.log(result1.errors); // ["Password must be at least 16 characters long"]

// Should FAIL (no special char)
const result2 = validatePassword('LongPassword1234');
console.log(result2.isValid); // false
console.log(result2.errors); // ["Password must contain at least one special character"]

// Should PASS
const result3 = validatePassword('VeryLongPassword123!');
console.log(result3.isValid); // true
console.log(result3.strength); // { score: 4, label: 'strong', color: 'green' }

// Test with Tenant B (lenient policy)
const { validatePassword: validateB } = usePasswordPolicy('tenant-b-id');

// Should PASS (meets lenient requirements)
const result4 = validateB('password');
console.log(result4.isValid); // true
```

### Integration Test

```typescript
// test/hooks/usePasswordPolicy.test.ts
describe('usePasswordPolicy', () => {
  it('should fetch policy from database', async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      usePasswordPolicy('tenant-a-id')
    );

    await waitForNextUpdate();

    expect(result.current.policy.minLength).toBe(16);
    expect(result.current.policy.requireSpecialChars).toBe(true);
  });

  it('should validate password against policy', async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      usePasswordPolicy('tenant-a-id')
    );

    await waitForNextUpdate();

    const validation = result.current.validatePassword('Short1!');
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Password must be at least 16 characters long');
  });

  it('should use default policy if org not found', async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      usePasswordPolicy('non-existent-id')
    );

    await waitForNextUpdate();

    expect(result.current.policy.minLength).toBe(8);
  });
});
```

### Success Criteria
- ✅ Hook fetches policy from database
- ✅ Validation uses organization-specific rules
- ✅ Falls back to default policy on error
- ✅ Password strength calculated correctly
- ✅ User-friendly error messages

---

## Test 3: Audit Log Trigger

### Objective
Verify every UPDATE on organization_configurations creates an audit log entry

### Test File
`supabase/migrations/20260105000002_organization_config_audit_trigger.sql`

### How to Run Migration

```bash
# Apply migration
supabase db push

# Or manually
psql $DATABASE_URL -f supabase/migrations/20260105000002_organization_config_audit_trigger.sql
```

### Manual Test

```sql
-- 1. Count audit logs before
SELECT COUNT(*) as before_count
FROM audit_logs
WHERE resource_type = 'organization_configuration'
AND resource_id = 'tenant-a-id';

-- 2. Update configuration
UPDATE organization_configurations
SET auth_policy = jsonb_set(
  auth_policy,
  '{enforceMFA}',
  'true'::jsonb
)
WHERE organization_id = 'tenant-a-id';

-- 3. Count audit logs after
SELECT COUNT(*) as after_count
FROM audit_logs
WHERE resource_type = 'organization_configuration'
AND resource_id = 'tenant-a-id';

-- 4. Verify audit log details
SELECT
  user_id,
  action,
  resource_type,
  resource_id,
  changes,
  metadata,
  created_at
FROM audit_logs
WHERE resource_type = 'organization_configuration'
AND resource_id = 'tenant-a-id'
ORDER BY created_at DESC
LIMIT 1;
```

### Expected Audit Log Structure

```json
{
  "user_id": "current-user-id",
  "action": "UPDATE",
  "resource_type": "organization_configuration",
  "resource_id": "tenant-a-id",
  "old_values": {
    "auth_policy": {
      "enforceMFA": false,
      "passwordPolicy": {...}
    }
  },
  "new_values": {
    "auth_policy": {
      "enforceMFA": true,
      "passwordPolicy": {...}
    }
  },
  "changes": {
    "auth_policy": {
      "old": {"enforceMFA": false, ...},
      "new": {"enforceMFA": true, ...}
    }
  },
  "metadata": {
    "organization_id": "tenant-a-id",
    "configuration_id": "config-id",
    "changed_fields": ["auth_policy"]
  }
}
```

### Integration Test

```typescript
// test/audit/organization-config-audit.test.ts
describe('Organization Configuration Audit', () => {
  it('should create audit log on update', async () => {
    const beforeCount = await getAuditLogCount('tenant-a-id');

    await updateOrganizationConfig('tenant-a-id', {
      auth_policy: { enforceMFA: true }
    });

    const afterCount = await getAuditLogCount('tenant-a-id');
    expect(afterCount).toBe(beforeCount + 1);
  });

  it('should capture changed fields', async () => {
    await updateOrganizationConfig('tenant-a-id', {
      auth_policy: { enforceMFA: true }
    });

    const latestLog = await getLatestAuditLog('tenant-a-id');
    expect(latestLog.changes).toHaveProperty('auth_policy');
    expect(latestLog.changes.auth_policy.new.enforceMFA).toBe(true);
  });

  it('should include user context', async () => {
    await updateOrganizationConfig('tenant-a-id', {
      auth_policy: { enforceMFA: true }
    });

    const latestLog = await getLatestAuditLog('tenant-a-id');
    expect(latestLog.user_id).toBe(currentUserId);
  });
});
```

### Success Criteria
- ✅ Audit log created on every UPDATE
- ✅ Old and new values captured
- ✅ Only changed fields in `changes` object
- ✅ User context captured
- ✅ Metadata includes organization_id
- ✅ Timestamp recorded

---

## Comprehensive Integration Test

### Test All Three Features Together

```typescript
// test/integration/phase2-security.test.ts
describe('Phase 2: Security & Permissions Integration', () => {
  let tenantA: string;
  let tenantB: string;
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    // Setup test data
    tenantA = await createTestTenant('Tenant A');
    tenantB = await createTestTenant('Tenant B');
    userA = await createTestUser('user-a@tenant-a.com', tenantA);
    userB = await createTestUser('user-b@tenant-b.com', tenantB);
  });

  describe('RLS Policy Validation', () => {
    it('should prevent cross-tenant access', async () => {
      // User A tries to access Tenant B config
      const result = await fetchOrganizationConfig(tenantB, userA);
      expect(result).toBeNull(); // RLS blocks access
    });

    it('should allow same-tenant access', async () => {
      const result = await fetchOrganizationConfig(tenantA, userA);
      expect(result).not.toBeNull();
    });
  });

  describe('Password Policy Integration', () => {
    it('should enforce organization password policy', async () => {
      // Set strict policy for Tenant A
      await updatePasswordPolicy(tenantA, {
        minLength: 16,
        requireSpecialChars: true
      });

      // Validate password
      const { validatePassword } = usePasswordPolicy(tenantA);
      const result = validatePassword('Short1!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 16 characters long');
    });
  });

  describe('Audit Log Trigger', () => {
    it('should log configuration changes', async () => {
      const beforeCount = await getAuditLogCount(tenantA);

      await updateOrganizationConfig(tenantA, {
        auth_policy: { enforceMFA: true }
      });

      const afterCount = await getAuditLogCount(tenantA);
      expect(afterCount).toBe(beforeCount + 1);

      const log = await getLatestAuditLog(tenantA);
      expect(log.action).toBe('UPDATE');
      expect(log.resource_type).toBe('organization_configuration');
    });
  });

  afterAll(async () => {
    // Cleanup
    await deleteTestData();
  });
});
```

---

## Performance Tests

### RLS Performance

```sql
-- Test RLS query performance
EXPLAIN ANALYZE
SELECT * FROM organization_configurations
WHERE organization_id IN (
  SELECT tenant_id FROM user_tenants
  WHERE user_id = 'user-a-id'
  AND status = 'active'
);

-- Should use index and complete in < 10ms
```

### Audit Log Performance

```sql
-- Test audit log insertion performance
EXPLAIN ANALYZE
UPDATE organization_configurations
SET auth_policy = jsonb_set(auth_policy, '{enforceMFA}', 'true'::jsonb)
WHERE organization_id = 'tenant-a-id';

-- Should complete in < 50ms including audit log
```

---

## Compliance Verification

### SOC2 Requirements

- ✅ **CC6.1**: Tenant isolation via RLS
- ✅ **CC6.2**: Password policy enforcement
- ✅ **CC7.2**: Audit logging of configuration changes

### GDPR Requirements

- ✅ **Article 32**: Security measures (RLS, password policy)
- ✅ **Article 30**: Records of processing (audit logs)

---

## Troubleshooting

### RLS Tests Failing

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('organization_configurations', 'teams');

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('organization_configurations', 'teams');
```

### Password Policy Not Loading

```typescript
// Check database connection
const { data, error } = await supabase
  .from('organization_configurations')
  .select('auth_policy')
  .eq('organization_id', organizationId)
  .single();

console.log('Policy data:', data);
console.log('Error:', error);
```

### Audit Logs Not Created

```sql
-- Check if trigger exists
SELECT tgname, tgtype, tgenabled
FROM pg_trigger
WHERE tgrelid = 'organization_configurations'::regclass;

-- Check audit_logs table
SELECT COUNT(*) FROM audit_logs
WHERE resource_type = 'organization_configuration';

-- Check for errors in logs
SELECT * FROM pg_stat_activity
WHERE state = 'idle in transaction (aborted)';
```

---

## Success Checklist

### Task 1: RLS Policy Validation
- [ ] All 12 RLS tests pass
- [ ] Cross-tenant access blocked
- [ ] Same-tenant access allowed
- [ ] Service role has full access
- [ ] Performance acceptable (< 10ms)

### Task 2: Password Policy Integration
- [ ] Hook fetches policy from database
- [ ] Validation enforces organization rules
- [ ] Falls back to default on error
- [ ] Strength calculation works
- [ ] Error messages are clear

### Task 3: Audit Log Trigger
- [ ] Trigger fires on every UPDATE
- [ ] Old and new values captured
- [ ] Changes calculated correctly
- [ ] User context included
- [ ] Metadata complete
- [ ] Performance acceptable (< 50ms)

---

**Status**: Ready for Testing  
**Estimated Time**: 2 hours  
**Priority**: HIGH
