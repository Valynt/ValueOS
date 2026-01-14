# Database Infrastructure Requirements

## Overview

This document outlines the database infrastructure requirements identified during enterprise test implementation. These requirements are necessary to support GDPR compliance, billing enforcement, and tenant isolation.

---

## 1. Legal Holds Table

**Purpose:** Prevent data deletion during litigation or regulatory investigations

**Schema:**
```sql
CREATE TABLE legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  reason TEXT NOT NULL,
  case_number TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'lifted')),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_legal_holds_user_id ON legal_holds(user_id);
CREATE INDEX idx_legal_holds_tenant_id ON legal_holds(tenant_id);
CREATE INDEX idx_legal_holds_status ON legal_holds(status);
```

**Enforcement:**
```sql
-- Trigger to prevent user deletion when legal hold is active
CREATE OR REPLACE FUNCTION prevent_deletion_with_legal_hold()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM legal_holds
    WHERE user_id = OLD.id
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Cannot delete user: active legal hold exists';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_legal_hold_before_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_deletion_with_legal_hold();
```

**Tests:** `tests/compliance/privacy/right-to-be-forgotten.test.ts`

---

## 2. User Deletions Audit Table

**Purpose:** Track deletion requests for audit and compliance

**Schema:**
```sql
CREATE TABLE user_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  deletion_type TEXT NOT NULL CHECK (deletion_type IN ('user_request', 'admin_action', 'gdpr_compliance', 'account_closure')),
  reason TEXT,
  data_exported BOOLEAN DEFAULT FALSE,
  export_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_user_deletions_user_id ON user_deletions(user_id);
CREATE INDEX idx_user_deletions_requested_at ON user_deletions(requested_at);
CREATE INDEX idx_user_deletions_completed_at ON user_deletions(completed_at);
```

**Retention:** 7 years (compliance requirement)

**Tests:** `tests/compliance/privacy/right-to-be-forgotten.test.ts`

---

## 3. Audit Log Anonymization Trigger

**Purpose:** Anonymize user_id in audit logs after user deletion

**Implementation:**
```sql
CREATE OR REPLACE FUNCTION anonymize_audit_logs_on_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Anonymize user_id in security_audit_events
  UPDATE security_audit_events
  SET user_id = '[DELETED]',
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{anonymized_at}',
        to_jsonb(NOW())
      )
  WHERE user_id = OLD.id;

  -- Log the anonymization
  INSERT INTO user_deletions (
    user_id,
    user_email,
    deletion_type,
    completed_at
  ) VALUES (
    OLD.id,
    OLD.email,
    'user_request',
    NOW()
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER anonymize_audit_logs_after_user_delete
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION anonymize_audit_logs_on_user_deletion();
```

**Tests:** `tests/compliance/privacy/right-to-be-forgotten.test.ts`

---

## 4. Retention Policy Enforcement Triggers

**Purpose:** Prevent premature deletion of data

**Implementation:**
```sql
-- Prevent deletion of audit logs before retention period
CREATE OR REPLACE FUNCTION enforce_audit_log_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '7 years';
BEGIN
  IF OLD.created_at > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete audit logs before retention period expires (7 years)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_audit_log_retention
  BEFORE DELETE ON security_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_audit_log_retention();

-- Prevent deletion of financial records before retention period
CREATE OR REPLACE FUNCTION enforce_financial_record_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '7 years';
BEGIN
  IF OLD.created_at > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete financial records before retention period expires (7 years)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_financial_record_retention
  BEFORE DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION enforce_financial_record_retention();
```

**Tests:** `tests/compliance/privacy/data-retention.test.ts`

---

## 5. Scheduled Deletion Jobs

**Purpose:** Automated cleanup of expired data

### Job 1: Delete Expired Sessions
```sql
-- Function to delete expired sessions
CREATE OR REPLACE FUNCTION delete_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sessions
  WHERE expires_at < NOW() - INTERVAL '30 days'
  RETURNING COUNT(*) INTO deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

**Schedule:** Daily at 2 AM
```bash
# Cron expression: 0 2 * * *
# Implementation: pg_cron or external scheduler
SELECT cron.schedule('delete-expired-sessions', '0 2 * * *', 'SELECT delete_expired_sessions()');
```

### Job 2: Delete Expired Temporary Files
```sql
CREATE OR REPLACE FUNCTION delete_expired_temp_files()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM temp_files
  WHERE created_at < NOW() - INTERVAL '7 days'
  RETURNING COUNT(*) INTO deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

**Schedule:** Daily at 3 AM
```bash
# Cron expression: 0 3 * * *
SELECT cron.schedule('delete-expired-temp-files', '0 3 * * *', 'SELECT delete_expired_temp_files()');
```

### Job 3: Permanently Delete Soft-Deleted Users
```sql
CREATE OR REPLACE FUNCTION permanently_delete_soft_deleted_users()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete users who were soft-deleted more than 30 days ago
  DELETE FROM auth.users
  WHERE deleted_at IS NOT NULL
  AND deleted_at < NOW() - INTERVAL '30 days'
  RETURNING COUNT(*) INTO deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

**Schedule:** Weekly on Sunday at 4 AM
```bash
# Cron expression: 0 4 * * 0
SELECT cron.schedule('permanently-delete-soft-deleted-users', '0 4 * * 0', 'SELECT permanently_delete_soft_deleted_users()');
```

**Tests:** `tests/compliance/privacy/data-retention.test.ts`

---

## 6. Cross-Region Transfer Logging

**Purpose:** Audit cross-region data access for sovereignty compliance

**Schema:**
```sql
CREATE TABLE cross_region_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  from_region TEXT NOT NULL,
  to_region TEXT NOT NULL,
  data_type TEXT NOT NULL,
  data_size_bytes BIGINT,
  legal_basis TEXT NOT NULL CHECK (legal_basis IN (
    'user_consent',
    'standard_contractual_clauses',
    'adequacy_decision',
    'binding_corporate_rules',
    'derogation'
  )),
  consent_id UUID REFERENCES user_consents(id),
  transferred_by UUID NOT NULL REFERENCES auth.users(id),
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purpose TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_cross_region_transfers_user_id ON cross_region_transfers(user_id);
CREATE INDEX idx_cross_region_transfers_tenant_id ON cross_region_transfers(tenant_id);
CREATE INDEX idx_cross_region_transfers_from_region ON cross_region_transfers(from_region);
CREATE INDEX idx_cross_region_transfers_to_region ON cross_region_transfers(to_region);
CREATE INDEX idx_cross_region_transfers_transferred_at ON cross_region_transfers(transferred_at);
```

**Retention:** 7 years (compliance requirement)

**Tests:** `tests/compliance/privacy/regional-residency.test.ts`

---

## 7. Data Region Metadata

**Purpose:** Track data location for sovereignty compliance

**Implementation:**

### Add data_region column to relevant tables
```sql
-- Add to tenants table
ALTER TABLE tenants
ADD COLUMN data_region TEXT NOT NULL DEFAULT 'us'
CHECK (data_region IN ('eu', 'us', 'ap', 'uk', 'ca'));

CREATE INDEX idx_tenants_data_region ON tenants(data_region);

-- Add to users table (via user_metadata)
-- Already supported via JSONB user_metadata field

-- Add to storage buckets
ALTER TABLE storage.buckets
ADD COLUMN data_region TEXT NOT NULL DEFAULT 'us'
CHECK (data_region IN ('eu', 'us', 'ap', 'uk', 'ca'));
```

### Enforce data region constraints
```sql
CREATE OR REPLACE FUNCTION enforce_data_region()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure data is created in correct region
  IF NEW.tenant_id IS NOT NULL THEN
    DECLARE
      tenant_region TEXT;
    BEGIN
      SELECT data_region INTO tenant_region
      FROM tenants
      WHERE id = NEW.tenant_id;

      IF tenant_region IS NOT NULL AND NEW.data_region != tenant_region THEN
        RAISE EXCEPTION 'Data region mismatch: expected %, got %', tenant_region, NEW.data_region;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER enforce_data_region_on_insert
  BEFORE INSERT ON cases
  FOR EACH ROW
  EXECUTE FUNCTION enforce_data_region();
```

**Tests:** `tests/compliance/privacy/regional-residency.test.ts`

---

## 8. Usage Quota Enforcement

**Purpose:** Enforce billing plan limits in real-time

**Schema:**
```sql
CREATE TABLE usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  subscription_id UUID REFERENCES subscriptions(id),
  metric TEXT NOT NULL CHECK (metric IN (
    'llm_tokens',
    'agent_executions',
    'api_calls',
    'storage_gb',
    'user_seats'
  )),
  quota_amount BIGINT NOT NULL,
  current_usage BIGINT NOT NULL DEFAULT 0,
  hard_cap BOOLEAN NOT NULL DEFAULT FALSE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, metric, period_start)
);

CREATE INDEX idx_usage_quotas_tenant_id ON usage_quotas(tenant_id);
CREATE INDEX idx_usage_quotas_metric ON usage_quotas(metric);
CREATE INDEX idx_usage_quotas_period ON usage_quotas(period_start, period_end);
```

**Enforcement Function:**
```sql
CREATE OR REPLACE FUNCTION check_usage_quota(
  p_tenant_id UUID,
  p_metric TEXT,
  p_amount BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
  v_quota usage_quotas%ROWTYPE;
  v_new_usage BIGINT;
BEGIN
  -- Get current quota
  SELECT * INTO v_quota
  FROM usage_quotas
  WHERE tenant_id = p_tenant_id
  AND metric = p_metric
  AND period_start <= NOW()
  AND period_end > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No quota found for tenant % and metric %', p_tenant_id, p_metric;
  END IF;

  v_new_usage := v_quota.current_usage + p_amount;

  -- Check if quota would be exceeded
  IF v_quota.hard_cap AND v_new_usage > v_quota.quota_amount THEN
    RETURN FALSE;
  END IF;

  -- Update usage
  UPDATE usage_quotas
  SET current_usage = v_new_usage,
      updated_at = NOW()
  WHERE id = v_quota.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

**Tests:** `tests/billing/enforcement/plan-enforcement.test.ts`

---

## 9. Tenant Isolation Enhancements

**Purpose:** Ensure strict tenant isolation via RLS

### Add tenant_id to all tables
```sql
-- Example for cases table
ALTER TABLE cases
ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Make it NOT NULL after backfilling
UPDATE cases SET tenant_id = (
  SELECT tenant_id FROM user_tenants
  WHERE user_tenants.user_id = cases.user_id
  LIMIT 1
);

ALTER TABLE cases
ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX idx_cases_tenant_id ON cases(tenant_id);
```

### Enable RLS on all tables
```sql
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's data
CREATE POLICY tenant_isolation_policy ON cases
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.status = 'active'
      LIMIT 1
    )
  );

-- Policy: Service role can access all data
CREATE POLICY service_role_policy ON cases
  FOR ALL
  TO service_role
  USING (true);
```

**Tests:** `tests/compliance/security/tenant-isolation-verification.test.ts`

---

## 10. Billing Usage Events Table

**Purpose:** Track usage events for accurate billing

**Schema:**
```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  metric TEXT NOT NULL CHECK (metric IN (
    'llm_tokens',
    'agent_executions',
    'api_calls',
    'storage_gb',
    'user_seats'
  )),
  amount BIGINT NOT NULL,
  request_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(request_id) -- Idempotency
);

CREATE INDEX idx_usage_events_tenant_id ON usage_events(tenant_id);
CREATE INDEX idx_usage_events_metric ON usage_events(metric);
CREATE INDEX idx_usage_events_timestamp ON usage_events(timestamp);
CREATE INDEX idx_usage_events_processed ON usage_events(processed);
CREATE INDEX idx_usage_events_request_id ON usage_events(request_id);
```

**Tests:** `tests/billing/metering/usage-metering.test.ts`

---

## Implementation Priority

### Phase 1: Critical (Week 1)
1. ✅ Tenant isolation enhancements (RLS policies)
2. ✅ Usage quota enforcement
3. ✅ Usage events table

### Phase 2: High Priority (Week 2)
4. ✅ Legal holds table
5. ✅ User deletions audit table
6. ✅ Audit log anonymization trigger

### Phase 3: Medium Priority (Week 3)
7. ✅ Retention policy enforcement triggers
8. ✅ Cross-region transfer logging
9. ✅ Data region metadata

### Phase 4: Automation (Week 4)
10. ✅ Scheduled deletion jobs
11. ✅ Usage aggregation jobs
12. ✅ Monitoring and alerting

---

## Migration Scripts

### Create all tables
```bash
# Run migrations in order
psql $DATABASE_URL -f migrations/001_legal_holds.sql
psql $DATABASE_URL -f migrations/002_user_deletions.sql
psql $DATABASE_URL -f migrations/003_cross_region_transfers.sql
psql $DATABASE_URL -f migrations/004_usage_quotas.sql
psql $DATABASE_URL -f migrations/005_usage_events.sql
```

### Enable pg_cron extension
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
```

### Schedule jobs
```sql
-- Delete expired sessions (daily at 2 AM)
SELECT cron.schedule('delete-expired-sessions', '0 2 * * *', 'SELECT delete_expired_sessions()');

-- Delete expired temp files (daily at 3 AM)
SELECT cron.schedule('delete-expired-temp-files', '0 3 * * *', 'SELECT delete_expired_temp_files()');

-- Permanently delete soft-deleted users (weekly on Sunday at 4 AM)
SELECT cron.schedule('permanently-delete-soft-deleted-users', '0 4 * * 0', 'SELECT permanently_delete_soft_deleted_users()');
```

---

## Monitoring and Alerting

### Key Metrics to Monitor
1. Cross-tenant access attempts (should be 0)
2. Legal hold violations (should be 0)
3. Retention policy violations (should be 0)
4. Usage quota breaches
5. Scheduled job failures
6. Data region violations (should be 0)

### Alerts to Configure
1. **Critical:** Cross-tenant data access detected
2. **Critical:** Legal hold violation attempted
3. **High:** Retention policy violation
4. **High:** Scheduled job failed
5. **Medium:** Usage quota exceeded
6. **Medium:** Data region mismatch

---

## Testing

All database infrastructure requirements have corresponding tests:

| Requirement | Test File | Status |
|-------------|-----------|--------|
| Legal Holds | `right-to-be-forgotten.test.ts` | ✅ Implemented |
| User Deletions | `right-to-be-forgotten.test.ts` | ✅ Implemented |
| Audit Log Anonymization | `right-to-be-forgotten.test.ts` | ✅ Implemented |
| Retention Policies | `data-retention.test.ts` | ✅ Implemented |
| Cross-Region Transfers | `regional-residency.test.ts` | ✅ Implemented |
| Data Region Metadata | `regional-residency.test.ts` | ✅ Implemented |
| Usage Quotas | `plan-enforcement.test.ts` | ✅ Implemented |
| Usage Events | `usage-metering.test.ts` | ✅ Implemented |
| Tenant Isolation | `tenant-isolation-verification.test.ts` | ✅ Implemented |

---

## Conclusion

These database infrastructure requirements are essential for:
- **GDPR Compliance:** Legal holds, user deletions, audit log anonymization
- **SOC2 Compliance:** Audit trails, retention policies, tenant isolation
- **Revenue Protection:** Usage quotas, billing enforcement
- **Data Sovereignty:** Regional residency, cross-region transfer logging

**Estimated Implementation Time:** 2-3 weeks
**Priority:** High (blocks certification)
**Dependencies:** PostgreSQL 14+, pg_cron extension

---

**Document Version:** 1.0
**Last Updated:** 2026-01-03
**Status:** Ready for Implementation
