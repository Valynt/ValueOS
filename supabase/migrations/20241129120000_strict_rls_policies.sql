-- Strict Row-Level Security Policies
-- Comprehensive RLS enforcement for multi-tenant isolation

-- Enable RLS on all tables
ALTER TABLE IF EXISTS user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS value_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS canvas_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS billing_usage ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (wrapped in conditional checks)
DO $$
BEGIN
  -- user_tenants policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_tenants') THEN
    DROP POLICY IF EXISTS "Users can view their own tenant memberships" ON user_tenants;
  END IF;
  
  -- workflow_executions policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_executions') THEN
    DROP POLICY IF EXISTS "Users can view workflow executions in their tenants" ON workflow_executions;
    DROP POLICY IF EXISTS "Users can create workflow executions in their tenants" ON workflow_executions;
    DROP POLICY IF EXISTS "Users can update their own workflow executions" ON workflow_executions;
  END IF;
  
  -- workflow_execution_logs policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_execution_logs') THEN
    DROP POLICY IF EXISTS "Users can view logs for their workflow executions" ON workflow_execution_logs;
  END IF;
  
  -- workflow_events policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_events') THEN
    DROP POLICY IF EXISTS "Users can view events for their workflow executions" ON workflow_events;
  END IF;
  
  -- workflow_audit_logs policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_audit_logs') THEN
    DROP POLICY IF EXISTS "Users can view audit logs for their workflow executions" ON workflow_audit_logs;
  END IF;
  
  -- agent_predictions policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_predictions') THEN
    DROP POLICY IF EXISTS "Users can view their own predictions" ON agent_predictions;
    DROP POLICY IF EXISTS "Users can insert their own predictions" ON agent_predictions;
  END IF;
  
  -- value_trees policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'value_trees') THEN
    DROP POLICY IF EXISTS "Users can view their tenant value trees" ON value_trees;
    DROP POLICY IF EXISTS "Users can update their tenant value trees" ON value_trees;
  END IF;
  
  -- canvas_data policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'canvas_data') THEN
    DROP POLICY IF EXISTS "Users can view their tenant canvas data" ON canvas_data;
    DROP POLICY IF EXISTS "Users can update their tenant canvas data" ON canvas_data;
  END IF;
  
  -- billing_subscriptions policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'billing_subscriptions') THEN
    DROP POLICY IF EXISTS "Users can view their tenant subscriptions" ON billing_subscriptions;
  END IF;
  
  -- billing_usage policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'billing_usage') THEN
    DROP POLICY IF EXISTS "Users can view their tenant usage" ON billing_usage;
  END IF;
END $$;

-- User Tenants: Users can only see their own memberships (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_tenants') THEN
    CREATE POLICY "Users can view their own tenant memberships"
      ON user_tenants
      FOR SELECT
      USING (auth.uid() = user_id AND status = 'active');

    CREATE POLICY "Prevent unauthorized tenant changes"
      ON user_tenants
      FOR ALL
      USING (false); -- Only admin/backend can modify
  END IF;
END $$;

-- Workflow Executions: Scoped to user's tenants (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_executions') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_tenants') THEN
    
    CREATE POLICY "Users can view workflow executions in their tenants"
      ON workflow_executions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_tenants
          WHERE user_tenants.user_id = auth.uid()
            AND user_tenants.tenant_id = workflow_executions.tenant_id
            AND user_tenants.status = 'active'
        )
      );

    CREATE POLICY "Users can create workflow executions in their tenants"
      ON workflow_executions
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_tenants
          WHERE user_tenants.user_id = auth.uid()
            AND user_tenants.tenant_id = workflow_executions.tenant_id
            AND user_tenants.status = 'active'
        )
      );

    CREATE POLICY "Users can update their own workflow executions"
      ON workflow_executions
      FOR UPDATE
      USING (
        auth.uid() = created_by AND
        EXISTS (
          SELECT 1 FROM user_tenants
          WHERE user_tenants.user_id = auth.uid()
            AND user_tenants.tenant_id = workflow_executions.tenant_id
            AND user_tenants.status = 'active'
        )
      );
  END IF;
END $$;

-- Workflow Execution Logs: Scoped via parent workflow execution (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_execution_logs') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_executions') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_tenants') THEN
    
    CREATE POLICY "Users can view logs for their workflow executions"
      ON workflow_execution_logs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM workflow_executions we
          JOIN user_tenants ut ON ut.tenant_id = we.tenant_id
          WHERE we.id = workflow_execution_logs.execution_id
            AND ut.user_id = auth.uid()
            AND ut.status = 'active'
        )
      );
  END IF;
END $$;

-- Workflow Events: Scoped via parent workflow execution (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_events') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_executions') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_tenants') THEN
    
    CREATE POLICY "Users can view events for their workflow executions"
      ON workflow_events
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM workflow_executions we
          JOIN user_tenants ut ON ut.tenant_id = we.tenant_id
          WHERE we.id = workflow_events.execution_id
            AND ut.user_id = auth.uid()
            AND ut.status = 'active'
        )
      );
  END IF;
END $$;

-- Workflow Audit Logs: Scoped via parent workflow execution (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_audit_logs') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_executions') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_tenants') THEN
    
    CREATE POLICY "Users can view audit logs for their workflow executions"
      ON workflow_audit_logs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM workflow_executions we
          JOIN user_tenants ut ON ut.tenant_id = we.tenant_id
          WHERE we.id = workflow_audit_logs.execution_id
            AND ut.user_id = auth.uid()
            AND ut.status = 'active'
        )
      );
  END IF;
END $$;

-- Agent Predictions: User-scoped (conditional - check if user_id column exists)
DO $$
BEGIN
  -- Check if table exists AND has user_id column
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_predictions') AND
     EXISTS (SELECT FROM information_schema.columns 
             WHERE table_name = 'agent_predictions' AND column_name = 'user_id') THEN
    
    CREATE POLICY "Users can view their own predictions"
      ON agent_predictions
      FOR SELECT
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can insert their own predictions"
      ON agent_predictions
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);

    -- Prevent updates and deletes to predictions (append-only)
    CREATE POLICY "Prevent prediction modifications"
      ON agent_predictions
      FOR UPDATE
      USING (false);

    CREATE POLICY "Prevent prediction deletions"
      ON agent_predictions
      FOR DELETE
      USING (false);
  ELSIF EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_predictions') THEN
    -- Table exists but no user_id column - make policies that work with the actual schema
    -- Agent predictions are system-level, so just prevent modifications
    CREATE POLICY "Prevent prediction modifications"
      ON agent_predictions
      FOR UPDATE
      USING (false);

    CREATE POLICY "Prevent prediction deletions"
      ON agent_predictions
      FOR DELETE
      USING (false);
  END IF;
END $$;

-- Value Trees: Tenant-scoped (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'value_trees') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_tenants') THEN
    
    CREATE POLICY "Users can view their tenant value trees"
      ON value_trees
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_tenants
          WHERE user_tenants.user_id = auth.uid()
            AND user_tenants.tenant_id = value_trees.tenant_id
            AND user_tenants.status = 'active'
        )
      );

    CREATE POLICY "Users can update their tenant value trees"
      ON value_trees
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM user_tenants
          WHERE user_tenants.user_id = auth.uid()
            AND user_tenants.tenant_id = value_trees.tenant_id
            AND user_tenants.status = 'active'
            AND user_tenants.role IN ('admin', 'editor')
        )
      );
  END IF;
END $$;

-- Canvas Data: Tenant-scoped (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'canvas_data') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_tenants') THEN
    
    CREATE POLICY "Users can view their tenant canvas data"
      ON canvas_data
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_tenants
          WHERE user_tenants.user_id = auth.uid()
            AND user_tenants.tenant_id = canvas_data.tenant_id
            AND user_tenants.status = 'active'
        )
      );

    CREATE POLICY "Users can update their tenant canvas data"
      ON canvas_data
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM user_tenants
          WHERE user_tenants.user_id = auth.uid()
            AND user_tenants.tenant_id = canvas_data.tenant_id
            AND user_tenants.status = 'active'
            AND user_tenants.role IN ('admin', 'editor')
        )
      );
  END IF;
END $$;

-- Billing Subscriptions: Tenant-scoped, read-only for users (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'billing_subscriptions') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_tenants') THEN
    
    CREATE POLICY "Users can view their tenant subscriptions"
      ON billing_subscriptions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_tenants
          WHERE user_tenants.user_id = auth.uid()
            AND user_tenants.tenant_id = billing_subscriptions.tenant_id
            AND user_tenants.status = 'active'
        )
      );

    -- Prevent user modifications to billing (backend only)
    CREATE POLICY "Prevent user billing modifications"
      ON billing_subscriptions
      FOR ALL
      USING (false);
  END IF;
END $$;

-- Billing Usage: Tenant-scoped, read-only for users (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'billing_usage') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_tenants') THEN
    
    CREATE POLICY "Users can view their tenant usage"
      ON billing_usage
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_tenants
          WHERE user_tenants.user_id = auth.uid()
            AND user_tenants.tenant_id = billing_usage.tenant_id
            AND user_tenants.status = 'active'
        )
      );

    -- Prevent user modifications to usage data (backend only)
    CREATE POLICY "Prevent user usage modifications"
      ON billing_usage
      FOR ALL
      USING (false);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tenants_user_tenant 
  ON user_tenants(user_id, tenant_id) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant 
  ON workflow_executions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_agent_predictions_user 
  ON agent_predictions(user_id);

CREATE INDEX IF NOT EXISTS idx_value_trees_tenant 
  ON value_trees(tenant_id);

CREATE INDEX IF NOT EXISTS idx_canvas_data_tenant 
  ON canvas_data(tenant_id);

-- Add audit trigger for policy violations
CREATE OR REPLACE FUNCTION log_rls_violation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO security_audit_log (
    event_type,
    user_id,
    table_name,
    attempted_action,
    blocked_at
  ) VALUES (
    'rls_violation',
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    NOW()
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create security audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID,
  table_name TEXT,
  attempted_action TEXT,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Enable RLS on audit log itself
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_tenants') THEN
    CREATE POLICY "Only admins can view security audit logs"
      ON security_audit_log
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_tenants
          WHERE user_tenants.user_id = auth.uid()
            AND user_tenants.role = 'admin'
        )
      );
  ELSE
    -- If user_tenants doesn't exist, only service_role can view
    CREATE POLICY "Service role can view security audit logs"
      ON security_audit_log
      FOR SELECT
      TO service_role
      USING (true);
  END IF;
END $$;

COMMENT ON TABLE security_audit_log IS 'Append-only log of security events and RLS violations';
