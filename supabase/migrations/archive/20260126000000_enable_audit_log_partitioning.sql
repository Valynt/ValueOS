-- ============================================================================
-- ENABLE AUDIT LOG PARTITIONING
-- ============================================================================
-- Date: 2026-01-26
-- Priority: P2 (Scalability)
-- 
-- Implements range partitioning for high-volume audit tables:
-- 1. security_audit_log (partitioned by created_at)
-- 2. secret_audit_logs (partitioned by timestamp)
-- ============================================================================

-- 1. SECURITY AUDIT LOG PARTITIONING
-- ============================================================================

DO $$
BEGIN
  -- Only proceed if original table exists and is not already partitioned
  -- (We check if it's a regular table, 'r')
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'security_audit_log' AND c.relkind = 'r') THEN
    
    -- Rename existing table to legacy
    ALTER TABLE security_audit_log RENAME TO security_audit_log_legacy;
    
    -- Create new partitioned table
    CREATE TABLE security_audit_log (
      id UUID DEFAULT gen_random_uuid(),
      event_type TEXT NOT NULL,
      user_id UUID NOT NULL, -- enforcing NOT NULL for better data integrity if possible, otherwise REFERENCES auth.users(id)
      tenant_id UUID,
      details JSONB,
      severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      
      -- Composite PK required for partitioning
      PRIMARY KEY (id, created_at)
    ) PARTITION BY RANGE (created_at);

    -- Enable RLS
    ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

    -- Create Partitions (covering 2024-2026 for now)
    CREATE TABLE security_audit_log_2024 PARTITION OF security_audit_log FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
    CREATE TABLE security_audit_log_2025 PARTITION OF security_audit_log FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
    CREATE TABLE security_audit_log_2026 PARTITION OF security_audit_log FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
    -- Default partition for catching outliers
    CREATE TABLE security_audit_log_default PARTITION OF security_audit_log DEFAULT;

    -- Migrate Data
    INSERT INTO security_audit_log (id, event_type, user_id, tenant_id, details, severity, created_at)
    SELECT id, event_type, user_id, tenant_id, details, severity, created_at 
    FROM security_audit_log_legacy;

    -- Re-apply Policy
    -- Note: user_roles table might be needed for this policy as seen in original definition
    CREATE POLICY "admin_only_select" ON security_audit_log
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = (auth.uid())::text
            AND r.name IN ('admin', 'security_admin', 'system_admin')
        )
      );
      
    -- Drop legacy table (optional: keep as backup for safety, but here we drop to clean up)
    -- DROP TABLE security_audit_log_legacy;
    RAISE NOTICE 'Partitioning enabled for security_audit_log';
    
  ELSE
    RAISE NOTICE 'security_audit_log already partitioned or does not exist';
  END IF;
END $$;


-- 2. SECRET AUDIT LOG PARTITIONING
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'secret_audit_logs' AND c.relkind = 'r') THEN
    
    -- Rename existing table
    ALTER TABLE secret_audit_logs RENAME TO secret_audit_logs_legacy;
    
    -- Create partitioned table
    CREATE TABLE secret_audit_logs (
      id UUID DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255),
      secret_key VARCHAR(255) NOT NULL,
      secret_path TEXT,
      action VARCHAR(50) NOT NULL CHECK (action IN ('READ', 'WRITE', 'DELETE', 'ROTATE')),
      result VARCHAR(50) NOT NULL CHECK (result IN ('SUCCESS', 'FAILURE')),
      error_message TEXT,
      metadata JSONB DEFAULT '{}'::JSONB,
      timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      
      PRIMARY KEY (id, timestamp)
    ) PARTITION BY RANGE (timestamp);

    ALTER TABLE secret_audit_logs ENABLE ROW LEVEL SECURITY;

    -- Create Partitions
    CREATE TABLE secret_audit_logs_2024 PARTITION OF secret_audit_logs FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
    CREATE TABLE secret_audit_logs_2025 PARTITION OF secret_audit_logs FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
    CREATE TABLE secret_audit_logs_2026 PARTITION OF secret_audit_logs FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
    CREATE TABLE secret_audit_logs_default PARTITION OF secret_audit_logs DEFAULT;

    -- Migrate Data
    INSERT INTO secret_audit_logs (id, tenant_id, user_id, secret_key, secret_path, action, result, error_message, metadata, timestamp, created_at)
    SELECT id, tenant_id, user_id, secret_key, secret_path, action, result, error_message, metadata, timestamp, created_at
    FROM secret_audit_logs_legacy;

    -- Re-apply Policies
    CREATE POLICY secret_audit_logs_tenant_isolation ON secret_audit_logs
      FOR SELECT
      USING (tenant_id = current_setting('app.current_tenant_id', true));

    CREATE POLICY secret_audit_logs_system_access ON secret_audit_logs
      FOR SELECT
      TO authenticated
      USING (
        current_setting('app.current_user_role', true) = 'system'
        OR current_setting('app.current_user_role', true) = 'admin'
      );

    CREATE POLICY secret_audit_logs_system_insert ON secret_audit_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (
        current_setting('app.current_user_role', true) = 'system'
      );

    RAISE NOTICE 'Partitioning enabled for secret_audit_logs';

  ELSE
    RAISE NOTICE 'secret_audit_logs already partitioned or does not exist';
  END IF;
END $$;
