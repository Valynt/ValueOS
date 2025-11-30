# Phase 3: Infrastructure & Security Configuration Checklist

**Manual infrastructure steps required to complete Phase 3 data governance & compliance**

---

## ✅ Checklist Overview

- [ ] RLS (Row-Level Security) & ABAC Implementation
- [ ] TTL Jobs & Data Retention
- [ ] Audit Log Immutability
- [ ] Data Classification & Masking
- [ ] Sensitive Field Redaction
- [ ] Verification Testing

---

## 🔒 Part 1: RLS (Row-Level Security) & ABAC Implementation

### 1.1 Enable RLS on All Tables

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_enable_rls_all_tables.sql

-- Enable RLS on all application tables
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdui_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_exports ENABLE ROW LEVEL SECURITY;
```

### 1.2 Implement Role-Based Policies

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_rls_policies.sql

-- ============================================================================
-- User Roles (stored in user metadata)
-- ============================================================================
-- Roles: admin, manager, analyst, viewer

-- ============================================================================
-- Cases Table Policies
-- ============================================================================

-- Admins can see all cases
CREATE POLICY "admins_all_cases"
  ON cases FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- Managers can see cases in their department
CREATE POLICY "managers_department_cases"
  ON cases FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'manager'
    AND department_id IN (
      SELECT department_id 
      FROM user_departments 
      WHERE user_id = auth.uid()
    )
  );

-- Analysts can see and edit their own cases
CREATE POLICY "analysts_own_cases"
  ON cases FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'analyst'
    AND user_id = auth.uid()
  );

-- Viewers can only read cases they're assigned to
CREATE POLICY "viewers_assigned_cases"
  ON cases FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'viewer'
    AND id IN (
      SELECT case_id 
      FROM case_assignments 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Workflows Table Policies
-- ============================================================================

CREATE POLICY "workflows_owner_access"
  ON workflows FOR ALL
  USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "workflows_manager_read"
  ON workflows FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'manager'
    AND case_id IN (
      SELECT id FROM cases WHERE department_id IN (
        SELECT department_id FROM user_departments WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- Messages Table Policies (Chat/Conversation)
-- ============================================================================

CREATE POLICY "messages_case_access"
  ON messages FOR SELECT
  USING (
    case_id IN (
      SELECT id FROM cases WHERE user_id = auth.uid()
    )
    OR auth.jwt() ->> 'role' IN ('admin', 'manager')
  );

CREATE POLICY "messages_create_own"
  ON messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND case_id IN (
      SELECT id FROM cases WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Agent Executions Table Policies
-- ============================================================================

CREATE POLICY "agent_executions_admin_only"
  ON agent_executions FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "agent_executions_own_cases"
  ON agent_executions FOR SELECT
  USING (
    case_id IN (
      SELECT id FROM cases WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Audit Logs Policies (Read-only for authorized users)
-- ============================================================================

CREATE POLICY "audit_logs_admin_read"
  ON audit_logs FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "audit_logs_no_write"
  ON audit_logs FOR INSERT
  WITH CHECK (false);  -- No one can insert via SQL (only via secure RPC)

CREATE POLICY "audit_logs_no_update"
  ON audit_logs FOR UPDATE
  USING (false);  -- Immutable

CREATE POLICY "audit_logs_no_delete"
  ON audit_logs FOR DELETE
  USING (false);  -- Immutable

-- ============================================================================
-- Approval Requests Policies
-- ============================================================================

CREATE POLICY "approval_requests_admin_all"
  ON approval_requests FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "approval_requests_own"
  ON approval_requests FOR SELECT
  USING (
    requester_id = auth.uid()
  );

CREATE POLICY "approval_requests_approvers"
  ON approval_requests FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM approvers WHERE active = true
    )
  );
```

### 1.3 Attribute-Based Access Control (ABAC)

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_abac_policies.sql

-- Create attributes table
CREATE TABLE user_attributes (
  user_id UUID REFERENCES auth.users(id),
  attribute_key TEXT NOT NULL,
  attribute_value TEXT NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, attribute_key)
);

-- Function to check attribute
CREATE OR REPLACE FUNCTION has_attribute(key TEXT, value TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_attributes
    WHERE user_id = auth.uid()
      AND attribute_key = key
      AND attribute_value = value
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ABAC Policy Example: Cases with sensitivity level
CREATE POLICY "cases_abac_sensitivity"
  ON cases FOR SELECT
  USING (
    -- User has clearance level >= case sensitivity
    (
      SELECT COALESCE(MAX(attribute_value::int), 0)
      FROM user_attributes
      WHERE user_id = auth.uid()
        AND attribute_key = 'clearance_level'
        AND (expires_at IS NULL OR expires_at > NOW())
    ) >= COALESCE((metadata->>'sensitivity_level')::int, 0)
  );

-- ABAC Policy Example: Geographic restrictions
CREATE POLICY "cases_abac_geography"
  ON cases FOR SELECT
  USING (
    -- No geographic restrictions OR user has access to region
    (metadata->>'region') IS NULL
    OR has_attribute('region_access', metadata->>'region')
  );
```

Apply:
```bash
supabase db push
```

---

## ⏰ Part 2: TTL Jobs & Data Retention

### 2.1 Create Retention Policy Configuration

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_retention_policies.sql

CREATE TABLE retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL,
  date_column TEXT NOT NULL DEFAULT 'created_at',
  archive_before_delete BOOLEAN DEFAULT true,
  archive_table TEXT,
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default policies
INSERT INTO retention_policies (table_name, retention_days, archive_before_delete, archive_table) VALUES
  ('user_sessions', 90, false, null),
  ('messages', 730, true, 'messages_archive'),  -- 2 years
  ('agent_executions', 365, true, 'agent_executions_archive'),  -- 1 year
  ('audit_logs', 2555, true, 'audit_logs_archive'),  -- 7 years (compliance)
  ('sdui_layouts', 180, false, null),  -- 6 months
  ('data_exports', 30, false, null);  -- 30 days
```

### 2.2 Create Archive Tables

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_archive_tables.sql

-- Messages Archive
CREATE TABLE messages_archive (
  LIKE messages INCLUDING ALL
);

-- Agent Executions Archive
CREATE TABLE agent_executions_archive (
  LIKE agent_executions INCLUDING ALL
);

-- Audit Logs Archive (WORM storage - see Part 3)
CREATE TABLE audit_logs_archive (
  LIKE audit_logs INCLUDING ALL
);

-- Add archived_at timestamp
ALTER TABLE messages_archive ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE agent_executions_archive ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE audit_logs_archive ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NOW();
```

### 2.3 Create TTL Cleanup Function

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_ttl_cleanup_function.sql

CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS TABLE(
  table_name TEXT,
  archived_count BIGINT,
  deleted_count BIGINT,
  status TEXT
) AS $$
DECLARE
  policy RECORD;
  archived BIGINT;
  deleted BIGINT;
  cutoff_date TIMESTAMPTZ;
BEGIN
  FOR policy IN 
    SELECT * FROM retention_policies WHERE enabled = true
  LOOP
    cutoff_date := NOW() - (policy.retention_days || ' days')::INTERVAL;
    archived := 0;
    deleted := 0;
    
    BEGIN
      -- Archive if configured
      IF policy.archive_before_delete AND policy.archive_table IS NOT NULL THEN
        EXECUTE format(
          'INSERT INTO %I SELECT *, NOW() as archived_at FROM %I WHERE %I < $1',
          policy.archive_table,
          policy.table_name,
          policy.date_column
        ) USING cutoff_date;
        
        GET DIAGNOSTICS archived = ROW_COUNT;
      END IF;
      
      -- Delete expired records
      EXECUTE format(
        'DELETE FROM %I WHERE %I < $1',
        policy.table_name,
        policy.date_column
      ) USING cutoff_date;
      
      GET DIAGNOSTICS deleted = ROW_COUNT;
      
      -- Update last run time
      UPDATE retention_policies 
      SET last_run_at = NOW() 
      WHERE id = policy.id;
      
      -- Return results
      table_name := policy.table_name;
      archived_count := archived;
      deleted_count := deleted;
      status := 'success';
      RETURN NEXT;
      
    EXCEPTION WHEN OTHERS THEN
      table_name := policy.table_name;
      archived_count := 0;
      deleted_count := 0;
      status := 'error: ' || SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.4 Schedule TTL Job (pg_cron)

```sql
-- Install pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2 AM
SELECT cron.schedule(
  'daily-retention-cleanup',
  '0 2 * * *',  -- Every day at 2 AM
  'SELECT * FROM cleanup_expired_data()'
);
```

Or use Supabase Edge Functions for scheduling:

```typescript
// File: supabase/functions/scheduled-cleanup/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const { data, error } = await supabase.rpc('cleanup_expired_data');
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
  
  return new Response(JSON.stringify({ results: data }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

Deploy and schedule:
```bash
supabase functions deploy scheduled-cleanup
# Use external cron (GitHub Actions, etc.) to call this function daily
```

---

## 🔒 Part 3: Audit Log Immutability (WORM Storage)

### 3.1 Enforce Append-Only Audit Logs

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_audit_immutability.sql

-- Remove all write permissions except INSERT
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;
REVOKE UPDATE, DELETE ON audit_logs FROM anon;

-- Create secure insert function (only way to add audit logs)
CREATE OR REPLACE FUNCTION append_audit_log(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_metadata JSONB
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent',
    NOW()
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevent tampering via triggers
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER prevent_audit_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();
```

### 3.2 Optional: Hardware WORM Storage

For compliance requirements, configure S3 Object Lock or similar:

```bash
# AWS S3 with Object Lock (WORM)
aws s3api create-bucket \
  --bucket valuecanvas-audit-logs \
  --object-lock-enabled-for-bucket

aws s3api put-object-lock-configuration \
  --bucket valuecanvas-audit-logs \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Years": 7
      }
    }
  }'
```

Then export audit logs to S3 periodically:

```typescript
// File: supabase/functions/export-audit-logs/index.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-east-1' });

async function exportAuditLogs() {
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .gte('created_at', new Date(Date.now() - 86400000)); // Last 24 hours
  
  await s3.send(new PutObjectCommand({
    Bucket: 'valuecanvas-audit-logs',
    Key: `audit-logs-${new Date().toISOString()}.json`,
    Body: JSON.stringify(logs),
    ObjectLockMode: 'COMPLIANCE',
    ObjectLockRetainUntilDate: new Date(Date.now() + 7 * 365 * 86400000), // 7 years
  }));
}
```

---

## 🏷️ Part 4: Data Classification & Masking

### 4.1 Classify Data Sensitivity

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_data_classification.sql

CREATE TYPE sensitivity_level AS ENUM (
  'public',
  'internal',
  'confidential',
  'restricted'
);

-- Add classification to tables
ALTER TABLE cases ADD COLUMN sensitivity sensitivity_level DEFAULT 'internal';
ALTER TABLE messages ADD COLUMN sensitivity sensitivity_level DEFAULT 'internal';
ALTER TABLE user_data ADD COLUMN sensitivity sensitivity_level DEFAULT 'confidential';

-- Metadata-based classification
UPDATE cases 
SET sensitivity = 'restricted' 
WHERE metadata->>'contains_pii' = 'true';

UPDATE messages 
SET sensitivity = 'confidential' 
WHERE metadata->>'encrypted' = 'true';
```

### 4.2 Create Masking Functions

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_masking_functions.sql

-- Mask email addresses
CREATE OR REPLACE FUNCTION mask_email(email TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN REGEXP_REPLACE(email, '(.{2}).*(@.+)', '\1***\2');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Mask phone numbers
CREATE OR REPLACE FUNCTION mask_phone(phone TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN REGEXP_REPLACE(phone, '(\d{3})(\d{3})(\d{4})', '\1-***-\3');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Mask credit card numbers
CREATE OR REPLACE FUNCTION mask_credit_card(cc TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN REGEXP_REPLACE(cc, '(\d{4})(\d{8})(\d{4})', '\1-****-****-\3');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Mask SSN
CREATE OR REPLACE FUNCTION mask_ssn(ssn TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN REGEXP_REPLACE(ssn, '(\d{3})(\d{2})(\d{4})', '***-**-\3');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generic redaction
CREATE OR REPLACE FUNCTION redact_field(value TEXT, visible_chars INT DEFAULT 4)
RETURNS TEXT AS $$
BEGIN
  IF LENGTH(value) <= visible_chars THEN
    RETURN REPEAT('*', LENGTH(value));
  END IF;
  RETURN SUBSTRING(value FROM 1 FOR visible_chars) || REPEAT('*', LENGTH(value) - visible_chars);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### 4.3 Create Masked Views

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_masked_views.sql

-- Masked view for analysts (no PII)
CREATE VIEW cases_masked AS
SELECT
  id,
  title,
  description,
  status,
  created_at,
  mask_email(user_email) as user_email,
  mask_phone(user_phone) as user_phone,
  -- Remove sensitive metadata
  jsonb_strip_nulls(
    metadata - 'ssn' - 'credit_card' - 'bank_account'
  ) as metadata
FROM cases;

-- Grant access to masked view
GRANT SELECT ON cases_masked TO analyst_role;

-- Masked view for external users
CREATE VIEW cases_public AS
SELECT
  id,
  title,
  LEFT(description, 100) || '...' as description_preview,
  status,
  created_at
FROM cases
WHERE sensitivity = 'public';

GRANT SELECT ON cases_public TO anon;
```

### 4.4 Implement Field-Level Encryption

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_field_encryption.sql

-- Install pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption key management
CREATE TABLE encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT UNIQUE NOT NULL,
  encrypted_key BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true
);

-- Encrypt sensitive field function
CREATE OR REPLACE FUNCTION encrypt_sensitive_field(
  plaintext TEXT,
  key_name TEXT DEFAULT 'default'
)
RETURNS BYTEA AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Get encryption key from secure storage
  SELECT pgp_sym_encrypt_bytea(
    plaintext::BYTEA,
    current_setting('app.encryption_key', true)
  ) INTO encryption_key;
  
  RETURN encryption_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrypt sensitive field function
CREATE OR REPLACE FUNCTION decrypt_sensitive_field(
  encrypted BYTEA,
  key_name TEXT DEFAULT 'default'
)
RETURNS TEXT AS $$
DECLARE
  decrypted TEXT;
BEGIN
  -- Only admins can decrypt
  IF auth.jwt() ->> 'role' != 'admin' THEN
    RETURN '[ENCRYPTED]';
  END IF;
  
  SELECT pgp_sym_decrypt_bytea(
    encrypted,
    current_setting('app.encryption_key', true)
  )::TEXT INTO decrypted;
  
  RETURN decrypted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.5 Apply Masking/Redaction in Application Code

```typescript
// File: src/utils/dataMasking.ts
export function maskEmail(email: string): string {
  return email.replace(/(.{2}).*(@.+)/, '$1***$2');
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-***-$3');
}

export function maskCreditCard(cc: string): string {
  return cc.replace(/(\d{4})(\d{8})(\d{4})/, '$1-****-****-$3');
}

export function redactField(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars) {
    return '*'.repeat(value.length);
  }
  return value.substring(0, visibleChars) + '*'.repeat(value.length - visibleChars);
}

// Automatic masking based on field name
export function autoMask(data: Record<string, any>): Record<string, any> {
  const masked = { ...data };
  
  for (const [key, value] of Object.entries(masked)) {
    if (typeof value !== 'string') continue;
    
    if (key.includes('email')) {
      masked[key] = maskEmail(value);
    } else if (key.includes('phone')) {
      masked[key] = maskPhone(value);
    } else if (key.includes('ssn')) {
      masked[key] = '***-**-' + value.slice(-4);
    } else if (key.includes('credit') || key.includes('card')) {
      masked[key] = maskCreditCard(value);
    }
  }
  
  return masked;
}
```

Usage in API:
```typescript
// File: src/api/cases.ts
import { autoMask } from '../utils/dataMasking';

router.get('/cases/:id', async (req, res) => {
  const { data } = await supabase
    .from('cases')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  // Mask sensitive fields based on user role
  const userRole = (req as any).user?.role;
  
  if (userRole !== 'admin') {
    res.json(autoMask(data));
  } else {
    res.json(data);
  }
});
```

---

## ✅ Part 5: Verification Testing

### 5.1 Run Tests

```bash
# Run all tests
npm test

# Run specific Phase 3 tests
npm test -- src/utils/__tests__/dataMasking.test.ts
```

### 5.2 Manual Verification

#### Test RLS Policies

```sql
-- Login as analyst user
SET LOCAL role = analyst_role;
SET LOCAL "request.jwt.claims" = '{"role":"analyst","sub":"<user-id>"}';

-- Try to see other users' cases
SELECT * FROM cases WHERE user_id != '<user-id>';
-- Expected: Empty result (RLS blocks)

-- Try to see own cases
SELECT * FROM cases WHERE user_id = '<user-id>';
-- Expected: Success
```

#### Test TTL Cleanup

```sql
-- Run cleanup manually
SELECT * FROM cleanup_expired_data();

-- Verify old records were archived
SELECT COUNT(*) FROM messages WHERE created_at < NOW() - INTERVAL '730 days';
-- Expected: 0 (should be archived)

SELECT COUNT(*) FROM messages_archive;
-- Expected: > 0 (archived records)
```

#### Test Audit Immutability

```sql
-- Try to update audit log
UPDATE audit_logs SET action = 'MODIFIED' WHERE id = '<log-id>';
-- Expected: ERROR - Audit logs are immutable

-- Try to delete audit log
DELETE FROM audit_logs WHERE id = '<log-id>';
-- Expected: ERROR - Audit logs are immutable
```

#### Test Data Masking

```bash
# Query as non-admin user
curl -H "Authorization: Bearer <analyst-token>" \
  http://api-service/api/cases/123

# Expected: Masked data
# {
#   "user_email": "jo***@example.com",
#   "user_phone": "555-***-1234"
# }
```

#### Test Field Encryption

```sql
-- Verify encrypted storage
SELECT encrypted_ssn FROM user_data WHERE id = '<user-id>';
-- Expected: Bytea value (encrypted)

-- Decrypt as admin
SELECT decrypt_sensitive_field(encrypted_ssn) FROM user_data WHERE id = '<user-id>';
-- Expected: Decrypted value

-- Try to decrypt as non-admin
SET LOCAL "request.jwt.claims" = '{"role":"analyst"}';
SELECT decrypt_sensitive_field(encrypted_ssn) FROM user_data;
-- Expected: [ENCRYPTED]
```

---

## 📋 Deployment Checklist

Before going to production:

- [ ] RLS enabled on all tables
- [ ] Role-based policies applied (admin, manager, analyst, viewer)
- [ ] ABAC policies for sensitive data
- [ ] Retention policies configured for all tables
- [ ] Archive tables created
- [ ] TTL cleanup function deployed
- [ ] Scheduled job configured (pg_cron or Edge Function)
- [ ] Audit logs append-only (triggers in place)
- [ ] WORM storage configured (optional, for compliance)
- [ ] Data sensitivity classification applied
- [ ] Masking functions created
- [ ] Masked views for restricted roles
- [ ] Field-level encryption for PII
- [ ] Application-level masking implemented
- [ ] Tests passing (`npm test`)
- [ ] Manual verification completed
- [ ] Compliance requirements documented
- [ ] Data retention policy approved
- [ ] Monitoring/alerts for failed cleanup jobs

---

## 🔗 References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [GDPR Data Protection](https://gdpr.eu/)
- [CCPA Compliance](https://oag.ca.gov/privacy/ccpa)
- [NIST Data Classification](https://www.nist.gov/privacy-framework)
- Project docs: `docs/security/DATA_GOVERNANCE.md`

---

**Status:** Manual database/infrastructure configuration required  
**Owner:** DBA / Data Engineering / Compliance Teams  
**Timeline:** Complete before production deployment
