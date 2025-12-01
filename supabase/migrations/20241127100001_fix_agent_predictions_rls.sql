-- Fix: Enable RLS on Agent Prediction Tables
-- Addresses: CRITICAL security issue - prediction data exposed
-- Issue: agent_predictions, confidence_violations, agent_accuracy_metrics, agent_retraining_queue have no RLS

BEGIN;

-- Enable RLS on all agent prediction tables
ALTER TABLE IF EXISTS agent_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS confidence_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_accuracy_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_retraining_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Agent Predictions Policies
-- ============================================================================

-- Users can view predictions from their sessions
DROP POLICY IF EXISTS "Users view own predictions" ON agent_predictions;
CREATE POLICY "Users view own predictions"
  ON agent_predictions
  FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM agent_sessions WHERE user_id = auth.uid()
    )
  );

-- System can insert predictions
DROP POLICY IF EXISTS "System inserts predictions" ON agent_predictions;
CREATE POLICY "System inserts predictions"
  ON agent_predictions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Predictions are append-only (no updates/deletes)
DROP POLICY IF EXISTS "No prediction updates" ON agent_predictions;
CREATE POLICY "No prediction updates"
  ON agent_predictions
  FOR UPDATE
  TO authenticated, service_role
  USING (false);

DROP POLICY IF EXISTS "No prediction deletes" ON agent_predictions;
CREATE POLICY "No prediction deletes"
  ON agent_predictions
  FOR DELETE
  TO authenticated, service_role
  USING (false);

-- ============================================================================
-- Confidence Violations Policies
-- ============================================================================

-- Users view violations from their predictions
DROP POLICY IF EXISTS "Users view own violations" ON confidence_violations;
CREATE POLICY "Users view own violations"
  ON confidence_violations
  FOR SELECT
  TO authenticated
  USING (
    prediction_id IN (
      SELECT id FROM agent_predictions ap
      WHERE ap.session_id IN (
        SELECT id FROM agent_sessions WHERE user_id = auth.uid()
      )
    )
  );

-- System can insert violations
DROP POLICY IF EXISTS "System inserts violations" ON confidence_violations;
CREATE POLICY "System inserts violations"
  ON confidence_violations
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- Agent Accuracy Metrics Policies
-- ============================================================================

-- Organization-scoped or global metrics
DROP POLICY IF EXISTS "Org members view metrics" ON agent_accuracy_metrics;
CREATE POLICY "Org members view metrics"
  ON agent_accuracy_metrics
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL OR 
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- System can manage metrics
DROP POLICY IF EXISTS "System manages metrics" ON agent_accuracy_metrics;
CREATE POLICY "System manages metrics"
  ON agent_accuracy_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Agent Retraining Queue Policies
-- ============================================================================

-- Admin only
DROP POLICY IF EXISTS "Admins view retraining queue" ON agent_retraining_queue;
CREATE POLICY "Admins view retraining queue"
  ON agent_retraining_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
        AND r.role_name = 'admin'
        AND om.status = 'active'
    )
  );

-- System manages retraining queue
DROP POLICY IF EXISTS "System manages retraining" ON agent_retraining_queue;
CREATE POLICY "System manages retraining"
  ON agent_retraining_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;

-- Verification
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_predictions' AND rowsecurity = false) THEN
    RAISE EXCEPTION 'RLS not enabled on agent_predictions';
  END IF;
  
  RAISE NOTICE '✅ SUCCESS: RLS enabled on agent prediction tables';
END $$;
