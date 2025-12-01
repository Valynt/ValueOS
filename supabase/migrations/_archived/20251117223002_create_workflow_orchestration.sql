/*
  # Workflow Orchestration Schema

  1. New Tables
    - `workflow_definitions`: Stores versioned DAG definitions
    - `workflow_executions`: Tracks workflow run instances
    - `workflow_execution_logs`: Stage-level execution logs
    - `workflow_events`: Event stream for monitoring

  2. Schema Changes
    - Add `workflow_version` to all artifact tables

  3. Security
    - Enable RLS on all tables
    - Policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  dag_schema jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(name, version)
);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_name ON workflow_definitions(name);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_active ON workflow_definitions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_dag ON workflow_definitions USING gin(dag_schema);

ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow definitions"
  ON workflow_definitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create workflow definitions"
  ON workflow_definitions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their workflow definitions"
  ON workflow_definitions FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_definition_id uuid REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('initiated', 'in_progress', 'completed', 'failed', 'rolled_back')),
  current_stage text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  context jsonb DEFAULT '{}'::jsonb,
  circuit_breaker_state jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_definition ON workflow_executions(workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_by ON workflow_executions(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at DESC);

ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workflow executions"
  ON workflow_executions FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create workflow executions"
  ON workflow_executions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their workflow executions"
  ON workflow_executions FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE TABLE IF NOT EXISTS workflow_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES workflow_executions(id) ON DELETE CASCADE,
  stage_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  attempt_number integer DEFAULT 1,
  error_message text,
  input_data jsonb DEFAULT '{}'::jsonb,
  output_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_logs_execution ON workflow_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_stage ON workflow_execution_logs(stage_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_status ON workflow_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_started_at ON workflow_execution_logs(started_at DESC);

ALTER TABLE workflow_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs for their workflow executions"
  ON workflow_execution_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workflow_executions we
      WHERE we.id = workflow_execution_logs.execution_id
      AND we.created_by = auth.uid()
    )
  );

CREATE POLICY "System can insert workflow logs"
  ON workflow_execution_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflow_executions we
      WHERE we.id = workflow_execution_logs.execution_id
      AND we.created_by = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES workflow_executions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('stage_started', 'stage_completed', 'stage_failed', 'stage_retrying', 'workflow_completed', 'workflow_failed', 'workflow_rolled_back')),
  stage_id text,
  timestamp timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_events_execution ON workflow_events(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_type ON workflow_events(event_type);
CREATE INDEX IF NOT EXISTS idx_workflow_events_timestamp ON workflow_events(timestamp DESC);

ALTER TABLE workflow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events for their workflow executions"
  ON workflow_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workflow_executions we
      WHERE we.id = workflow_events.execution_id
      AND we.created_by = auth.uid()
    )
  );

CREATE POLICY "System can insert workflow events"
  ON workflow_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflow_executions we
      WHERE we.id = workflow_events.execution_id
      AND we.created_by = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'opportunity_artifacts' AND column_name = 'workflow_version'
  ) THEN
    ALTER TABLE opportunity_artifacts ADD COLUMN workflow_version uuid REFERENCES workflow_executions(id);
    CREATE INDEX IF NOT EXISTS idx_opportunity_artifacts_workflow ON opportunity_artifacts(workflow_version);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'target_artifacts' AND column_name = 'workflow_version'
  ) THEN
    ALTER TABLE target_artifacts ADD COLUMN workflow_version uuid REFERENCES workflow_executions(id);
    CREATE INDEX IF NOT EXISTS idx_target_artifacts_workflow ON target_artifacts(workflow_version);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'realization_artifacts' AND column_name = 'workflow_version'
  ) THEN
    ALTER TABLE realization_artifacts ADD COLUMN workflow_version uuid REFERENCES workflow_executions(id);
    CREATE INDEX IF NOT EXISTS idx_realization_artifacts_workflow ON realization_artifacts(workflow_version);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expansion_artifacts' AND column_name = 'workflow_version'
  ) THEN
    ALTER TABLE expansion_artifacts ADD COLUMN workflow_version uuid REFERENCES workflow_executions(id);
    CREATE INDEX IF NOT EXISTS idx_expansion_artifacts_workflow ON expansion_artifacts(workflow_version);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integrity_artifacts' AND column_name = 'workflow_version'
  ) THEN
    ALTER TABLE integrity_artifacts ADD COLUMN workflow_version uuid REFERENCES workflow_executions(id);
    CREATE INDEX IF NOT EXISTS idx_integrity_artifacts_workflow ON integrity_artifacts(workflow_version);
  END IF;
END $$;
