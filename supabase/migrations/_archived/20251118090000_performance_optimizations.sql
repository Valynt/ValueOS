/*
  # Performance and Query Optimization

  - Adds lifecycle stage tracking and supporting indexes
  - Improves timestamp and session-based query performance
  - Introduces performance_metrics table for agent execution latency
  - Adds depth-limited recursive helper for value tree traversal
*/

-- Lifecycle stage column for value cases (used for frequent filtering)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'value_cases' AND column_name = 'lifecycle_stage'
  ) THEN
    ALTER TABLE value_cases
    ADD COLUMN lifecycle_stage text DEFAULT 'opportunity'
    CHECK (lifecycle_stage IN ('opportunity', 'target', 'realization', 'expansion'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_value_cases_lifecycle_stage ON value_cases(lifecycle_stage);

-- Session and timestamp acceleration
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_status ON agent_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_started_at ON agent_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_timestamp ON agent_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_value_tree_nodes_created_at ON value_tree_nodes(created_at);

-- Depth-limited recursive CTE for value tree traversal
CREATE OR REPLACE FUNCTION get_value_tree_hierarchy(
  value_tree_uuid uuid,
  max_depth integer DEFAULT 5
) RETURNS TABLE (
  node_id uuid,
  parent_id uuid,
  depth integer
) AS $$
WITH RECURSIVE tree AS (
  SELECT
    vtn.id AS node_id,
    NULL::uuid AS parent_id,
    1 AS depth
  FROM value_tree_nodes vtn
  WHERE vtn.value_tree_id = value_tree_uuid
    AND NOT EXISTS (
      SELECT 1 FROM value_tree_links vtl WHERE vtl.child_id = vtn.id
    )
  UNION ALL
  SELECT
    vtl.child_id,
    vtl.parent_id,
    tree.depth + 1
  FROM value_tree_links vtl
  JOIN tree ON tree.node_id = vtl.parent_id
  WHERE tree.depth < max_depth
)
SELECT node_id, parent_id, depth FROM tree;
$$ LANGUAGE sql STABLE;

-- Centralized performance metrics for agent executions
CREATE TABLE IF NOT EXISTS performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES agent_sessions(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  operation text NOT NULL,
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  alert_threshold_ms integer DEFAULT 1000,
  alert_triggered boolean GENERATED ALWAYS AS (duration_ms >= alert_threshold_ms) STORED,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_session ON performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_agent ON performance_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created ON performance_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_duration ON performance_metrics(duration_ms DESC);

ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own performance metrics"
  ON performance_metrics FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_sessions asess
      WHERE asess.id = performance_metrics.session_id
      AND asess.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_sessions asess
      WHERE asess.id = performance_metrics.session_id
      AND asess.user_id = auth.uid()
    )
  );
