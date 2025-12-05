/*
  Extend workflow orchestration with audit trail, versioning, and retry metadata.
*/

ALTER TABLE workflow_executions
  ADD COLUMN IF NOT EXISTS workflow_version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS audit_context jsonb DEFAULT '{}'::jsonb;

ALTER TABLE workflow_execution_logs
  ADD COLUMN IF NOT EXISTS retry_policy jsonb;

CREATE TABLE IF NOT EXISTS workflow_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES workflow_executions(id) ON DELETE CASCADE,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_audit_execution ON workflow_audit_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_created ON workflow_audit_logs(created_at DESC);

ALTER TABLE workflow_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow audit logs" 
  ON workflow_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workflow_executions we
      WHERE we.id = workflow_audit_logs.execution_id
      AND we.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert workflow audit logs" 
  ON workflow_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflow_executions we
      WHERE we.id = workflow_audit_logs.execution_id
      AND we.created_by = auth.uid()
    )
  );
