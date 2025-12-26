-- Add canonical execution record metadata
ALTER TABLE IF EXISTS workflow_executions
  ADD COLUMN IF NOT EXISTS persona text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS fiscal_quarter text,
  ADD COLUMN IF NOT EXISTS execution_record jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_workflow_executions_persona ON workflow_executions(persona);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_industry ON workflow_executions(industry);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_quarter ON workflow_executions(fiscal_quarter);

-- Stage-level runs to back the execution record lifecycle
CREATE TABLE IF NOT EXISTS workflow_stage_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES workflow_executions(id) ON DELETE CASCADE,
  stage_id text NOT NULL,
  stage_name text,
  lifecycle_stage text,
  status text,
  inputs jsonb DEFAULT '{}'::jsonb,
  assumptions jsonb DEFAULT '[]'::jsonb,
  outputs jsonb DEFAULT '{}'::jsonb,
  economic_deltas jsonb DEFAULT '[]'::jsonb,
  persona text,
  industry text,
  fiscal_quarter text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_stage_runs_execution ON workflow_stage_runs(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_stage_runs_persona ON workflow_stage_runs(persona);
CREATE INDEX IF NOT EXISTS idx_workflow_stage_runs_industry ON workflow_stage_runs(industry);
CREATE INDEX IF NOT EXISTS idx_workflow_stage_runs_quarter ON workflow_stage_runs(fiscal_quarter);
