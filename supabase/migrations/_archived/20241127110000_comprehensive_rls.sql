-- Comprehensive Row-Level Security (RLS) Policies
-- Enables user/org isolation across all critical tables

-- ============================================================================
-- AGENT PREDICTIONS & SECURITY TABLES
-- ============================================================================

DO $$ 
BEGIN
  -- Only set up policies if both agent_predictions and agent_sessions exist
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_predictions') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_sessions') THEN
    
    -- Enable RLS on agent_predictions
    ALTER TABLE agent_predictions ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view own predictions" ON agent_predictions;
    DROP POLICY IF EXISTS "Users can insert own predictions" ON agent_predictions;
    DROP POLICY IF EXISTS "Service role full access to predictions" ON agent_predictions;

    -- Users can view their own predictions
    CREATE POLICY "Users can view own predictions"
      ON agent_predictions FOR SELECT
      USING (session_id IN (
        SELECT id FROM agent_sessions WHERE user_id = auth.uid()
      ));

    -- Users can insert their own predictions
    CREATE POLICY "Users can insert own predictions"
      ON agent_predictions FOR INSERT
      WITH CHECK (session_id IN (
        SELECT id FROM agent_sessions WHERE user_id = auth.uid()
      ));

    -- Service role can access all predictions
    CREATE POLICY "Service role full access to predictions"
      ON agent_predictions FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;

  -- Set up confidence_violations policies if tables exist
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'confidence_violations') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_predictions') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_sessions') THEN
    
    -- Enable RLS on confidence_violations
    ALTER TABLE confidence_violations ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view own violations" ON confidence_violations;
    DROP POLICY IF EXISTS "Service role full access to violations" ON confidence_violations;

    -- Users can view violations for their predictions
    CREATE POLICY "Users can view own violations"
      ON confidence_violations FOR SELECT
      USING (prediction_id IN (
        SELECT id FROM agent_predictions WHERE session_id IN (
          SELECT id FROM agent_sessions WHERE user_id = auth.uid()
        )
      ));

    -- Service role can access all violations
    CREATE POLICY "Service role full access to violations"
      ON confidence_violations FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_accuracy_metrics') THEN
    -- Enable RLS on agent_accuracy_metrics
    ALTER TABLE agent_accuracy_metrics ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view org metrics" ON agent_accuracy_metrics;
    DROP POLICY IF EXISTS "Service role full access to metrics" ON agent_accuracy_metrics;

    -- Users can view metrics for their organization
    CREATE POLICY "Users can view org metrics"
      ON agent_accuracy_metrics FOR SELECT
      USING (
        organization_id IS NULL OR 
        organization_id = (auth.jwt() ->> 'organization_id')
      );

    -- Service role can access all metrics
    CREATE POLICY "Service role full access to metrics"
      ON agent_accuracy_metrics FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_retraining_queue') THEN
    -- Enable RLS on agent_retraining_queue
    ALTER TABLE agent_retraining_queue ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Service role only for retraining queue" ON agent_retraining_queue;

    -- Only service role can access retraining queue
    CREATE POLICY "Service role only for retraining queue"
      ON agent_retraining_queue FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- WORKFLOW & SESSION TABLES
-- ============================================================================

-- Ensure RLS is enabled on workflow_states (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_states') THEN
    ALTER TABLE workflow_states ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view own workflows" ON workflow_states;
    DROP POLICY IF EXISTS "Users can update own workflows" ON workflow_states;
    DROP POLICY IF EXISTS "Service role full access to workflows" ON workflow_states;
    
    -- Users can view their own workflows
    CREATE POLICY "Users can view own workflows"
      ON workflow_states FOR SELECT
      USING (user_id = auth.uid());
    
    -- Users can update their own workflows
    CREATE POLICY "Users can update own workflows"
      ON workflow_states FOR UPDATE
      USING (user_id = auth.uid());
    
    -- Service role can access all workflows
    CREATE POLICY "Service role full access to workflows"
      ON workflow_states FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Ensure RLS is enabled on compensation_queue (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'compensation_queue') THEN
    ALTER TABLE compensation_queue ENABLE ROW LEVEL SECURITY;
    
    -- Only service role can access compensation queue
    CREATE POLICY "Service role only for compensation queue"
      ON compensation_queue FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- VALUE LIFECYCLE TABLES
-- ============================================================================

-- Ensure RLS on opportunity_results (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'opportunity_results') THEN
    ALTER TABLE opportunity_results ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view own opportunity results"
      ON opportunity_results FOR SELECT
      USING (user_id = auth.uid());
    
    CREATE POLICY "Users can insert own opportunity results"
      ON opportunity_results FOR INSERT
      WITH CHECK (user_id = auth.uid());
    
    CREATE POLICY "Service role full access to opportunity results"
      ON opportunity_results FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Ensure RLS on target_results (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'target_results') THEN
    ALTER TABLE target_results ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view own target results"
      ON target_results FOR SELECT
      USING (user_id = auth.uid());
    
    CREATE POLICY "Users can insert own target results"
      ON target_results FOR INSERT
      WITH CHECK (user_id = auth.uid());
    
    CREATE POLICY "Service role full access to target results"
      ON target_results FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Ensure RLS on expansion_results (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'expansion_results') THEN
    ALTER TABLE expansion_results ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view own expansion results"
      ON expansion_results FOR SELECT
      USING (user_id = auth.uid());
    
    CREATE POLICY "Users can insert own expansion results"
      ON expansion_results FOR INSERT
      WITH CHECK (user_id = auth.uid());
    
    CREATE POLICY "Service role full access to expansion results"
      ON expansion_results FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Ensure RLS on integrity_results (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'integrity_results') THEN
    ALTER TABLE integrity_results ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view own integrity results"
      ON integrity_results FOR SELECT
      USING (user_id = auth.uid());
    
    CREATE POLICY "Users can insert own integrity results"
      ON integrity_results FOR INSERT
      WITH CHECK (user_id = auth.uid());
    
    CREATE POLICY "Service role full access to integrity results"
      ON integrity_results FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Ensure RLS on realization_results (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'realization_results') THEN
    ALTER TABLE realization_results ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view own realization results"
      ON realization_results FOR SELECT
      USING (user_id = auth.uid());
    
    CREATE POLICY "Users can insert own realization results"
      ON realization_results FOR INSERT
      WITH CHECK (user_id = auth.uid());
    
    CREATE POLICY "Service role full access to realization results"
      ON realization_results FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- VALUE TREE TABLES
-- ============================================================================

-- Ensure RLS on value_trees (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'value_trees') THEN
    ALTER TABLE value_trees ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view own value trees"
      ON value_trees FOR SELECT
      USING (created_by = auth.uid() OR organization_id = (auth.jwt() ->> 'organization_id'));
    
    CREATE POLICY "Users can insert own value trees"
      ON value_trees FOR INSERT
      WITH CHECK (created_by = auth.uid());
    
    CREATE POLICY "Users can update own value trees"
      ON value_trees FOR UPDATE
      USING (created_by = auth.uid() OR organization_id = (auth.jwt() ->> 'organization_id'));
    
    CREATE POLICY "Service role full access to value trees"
      ON value_trees FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Ensure RLS on value_tree_nodes (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'value_tree_nodes') THEN
    ALTER TABLE value_tree_nodes ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view nodes of accessible trees"
      ON value_tree_nodes FOR SELECT
      USING (value_tree_id IN (
        SELECT id FROM value_trees 
        WHERE created_by = auth.uid() OR organization_id = (auth.jwt() ->> 'organization_id')
      ));
    
    CREATE POLICY "Users can modify nodes of own trees"
      ON value_tree_nodes FOR ALL
      USING (value_tree_id IN (
        SELECT id FROM value_trees WHERE created_by = auth.uid()
      ));
    
    CREATE POLICY "Service role full access to nodes"
      ON value_tree_nodes FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Ensure RLS on value_tree_links (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'value_tree_links') THEN
    ALTER TABLE value_tree_links ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view links of accessible trees"
      ON value_tree_links FOR SELECT
      USING (value_tree_id IN (
        SELECT id FROM value_trees 
        WHERE created_by = auth.uid() OR organization_id = (auth.jwt() ->> 'organization_id')
      ));
    
    CREATE POLICY "Users can modify links of own trees"
      ON value_tree_links FOR ALL
      USING (value_tree_id IN (
        SELECT id FROM value_trees WHERE created_by = auth.uid()
      ));
    
    CREATE POLICY "Service role full access to links"
      ON value_tree_links FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- FEEDBACK LOOP TABLES
-- ============================================================================

-- Ensure RLS on feedback_loops (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'feedback_loops') THEN
    ALTER TABLE feedback_loops ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view own feedback"
      ON feedback_loops FOR SELECT
      USING (recorded_by = auth.uid());
    
    CREATE POLICY "Users can insert own feedback"
      ON feedback_loops FOR INSERT
      WITH CHECK (recorded_by = auth.uid());
    
    CREATE POLICY "Service role full access to feedback"
      ON feedback_loops FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user has access to organization
CREATE OR REPLACE FUNCTION user_has_org_access(org_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN org_id = (auth.jwt() ->> 'organization_id');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'role') IN ('admin', 'service_role');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's organization ID
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt() ->> 'organization_id';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION user_has_org_access IS 'Check if current user has access to specified organization';
COMMENT ON FUNCTION user_is_admin IS 'Check if current user has admin privileges';
COMMENT ON FUNCTION get_user_org_id IS 'Get current user organization ID from JWT';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- To verify RLS is enabled, run:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;

-- To view all policies, run:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies WHERE schemaname = 'public';
