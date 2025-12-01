-- Strict Row-Level Security Policies
-- Comprehensive RLS enforcement for multi-tenant isolation

-- Enable RLS on all tables
ALTER TABLE IF EXISTS organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS value_trees ENABLE ROW LEVEL SECURITY;
-- canvas_data table does not exist, skipping
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usage_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (wrapped in conditional checks)
DO $$
BEGIN
  -- organization_members policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'organization_members') THEN
    DROP POLICY IF EXISTS "Users can view their own organization memberships" ON organization_members;
  END IF;
  
  -- workflow_executions policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_executions') THEN
    DROP POLICY IF EXISTS "Users can view their own workflow executions" ON workflow_executions;
    DROP POLICY IF EXISTS "Users can create their own workflow executions" ON workflow_executions;
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
    DROP POLICY IF EXISTS "Users can view their organization value trees" ON value_trees;
    DROP POLICY IF EXISTS "Users can update their organization value trees" ON value_trees;
  END IF;
  
  -- canvas_data table does not exist, skipping
  
  -- subscriptions policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'subscriptions') THEN
    DROP POLICY IF EXISTS "Users can view their tenant subscriptions" ON subscriptions;
  END IF;
  
  -- usage_events policies
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'usage_events') THEN
    DROP POLICY IF EXISTS "Users can view their tenant usage" ON usage_events;
  END IF;
END $$;

-- Organization Members: Users can only see their own memberships (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'organization_members') THEN
    CREATE POLICY "Users can view their own organization memberships"
      ON organization_members
      FOR SELECT
      USING (auth.uid() = user_id AND status = 'active');

    CREATE POLICY "Prevent unauthorized organization changes"
      ON organization_members
      FOR ALL
      USING (false); -- Only admin/backend can modify
  END IF;
END $$;

-- Workflow Executions: Scoped to user's sessions (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_executions') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_sessions') THEN
    
    CREATE POLICY "Users can view their own workflow executions"
      ON workflow_executions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM agent_sessions
          WHERE agent_sessions.id = workflow_executions.session_id
            AND agent_sessions.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can create their own workflow executions"
      ON workflow_executions
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM agent_sessions
          WHERE agent_sessions.id = workflow_executions.session_id
            AND agent_sessions.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can update their own workflow executions"
      ON workflow_executions
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM agent_sessions
          WHERE agent_sessions.id = workflow_executions.session_id
            AND agent_sessions.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Workflow Execution Logs: Scoped via parent workflow execution (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_execution_logs') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_executions') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_sessions') THEN
    
    CREATE POLICY "Users can view logs for their workflow executions"
      ON workflow_execution_logs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM workflow_executions we
          JOIN agent_sessions asess ON asess.id = we.session_id
          WHERE we.id = workflow_execution_logs.execution_id
            AND asess.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Workflow Events: Scoped via parent workflow execution (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_events') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_executions') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_sessions') THEN
    
    CREATE POLICY "Users can view events for their workflow executions"
      ON workflow_events
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM workflow_executions we
          JOIN agent_sessions asess ON asess.id = we.session_id
          WHERE we.id = workflow_events.execution_id
            AND asess.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Workflow Audit Logs: Scoped via parent workflow execution (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_audit_logs') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_executions') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_sessions') THEN
    
    CREATE POLICY "Users can view audit logs for their workflow executions"
      ON workflow_audit_logs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM workflow_executions we
          JOIN agent_sessions asess ON asess.id = we.session_id
          WHERE we.id = workflow_audit_logs.execution_id
            AND asess.user_id = auth.uid()
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

-- Value Trees: Organization-scoped (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'value_trees') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'organization_members') THEN
    
    CREATE POLICY "Users can view their organization value trees"
      ON value_trees
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_members.user_id = auth.uid()
            AND organization_members.organization_id = value_trees.organization_id
            AND organization_members.status = 'active'
        )
      );

    CREATE POLICY "Users can update their organization value trees"
      ON value_trees
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_members.user_id = auth.uid()
            AND organization_members.organization_id = value_trees.organization_id
            AND organization_members.status = 'active'
            AND organization_members.role_id IN (SELECT id FROM roles WHERE role_name IN ('admin', 'editor'))
        )
      );
  END IF;
END $$;

-- Canvas Data: Table does not exist, skipping policies

-- Subscriptions: Tenant-scoped, read-only for users (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'subscriptions') THEN
    
    CREATE POLICY "Users can view their tenant subscriptions"
      ON subscriptions
      FOR SELECT
      USING (
        tenant_id IN (
          SELECT organization_id 
          FROM organization_members 
          WHERE user_id = auth.uid() 
            AND status = 'active'
        )
      );

    -- Prevent user modifications to billing (backend only)
    CREATE POLICY "Prevent user billing modifications"
      ON subscriptions
      FOR ALL
      USING (false);
  END IF;
END $$;

-- Usage Events: Tenant-scoped, read-only for users (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'usage_events') THEN
    
    CREATE POLICY "Users can view their tenant usage"
      ON usage_events
      FOR SELECT
      USING (
        tenant_id IN (
          SELECT organization_id 
          FROM organization_members 
          WHERE user_id = auth.uid() 
            AND status = 'active'
        )
      );

    -- Prevent user modifications to usage data (backend only)
    CREATE POLICY "Prevent user usage modifications"
      ON usage_events
      FOR ALL
      USING (false);
  END IF;
END $$;

-- Create indexes for performance (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'organization_members') THEN
    CREATE INDEX IF NOT EXISTS idx_organization_members_user_org 
      ON organization_members(user_id, organization_id) 
      WHERE status = 'active';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_executions') AND
     EXISTS (SELECT FROM information_schema.columns 
             WHERE table_name = 'workflow_executions' AND column_name = 'session_id') THEN
    CREATE INDEX IF NOT EXISTS idx_workflow_executions_session 
      ON workflow_executions(session_id);
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_predictions') AND
     EXISTS (SELECT FROM information_schema.columns 
             WHERE table_name = 'agent_predictions' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_predictions_user 
      ON agent_predictions(user_id);
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'value_trees') AND
     EXISTS (SELECT FROM information_schema.columns 
             WHERE table_name = 'value_trees' AND column_name = 'organization_id') THEN
    CREATE INDEX IF NOT EXISTS idx_value_trees_org 
      ON value_trees(organization_id);
  END IF;

  -- canvas_data table does not exist, skipping index
END $$;

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
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'organization_members') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'roles') THEN
    CREATE POLICY "Only admins can view security audit logs"
      ON security_audit_log
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM organization_members om
          JOIN roles r ON r.id = om.role_id
          WHERE om.user_id = auth.uid()
            AND r.role_name = 'admin'
            AND om.status = 'active'
        )
      );
  ELSE
    -- If organization_members doesn't exist, only service_role can view
    CREATE POLICY "Service role can view security audit logs"
      ON security_audit_log
      FOR SELECT
      TO service_role
      USING (true);
  END IF;
END $$;

COMMENT ON TABLE security_audit_log IS 'Append-only log of security events and RLS violations';
