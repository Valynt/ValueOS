/*
  # Agent Fabric Complete Database Schema
  
  This migration creates the complete 18-table schema for the Agent Fabric system.
  
  ## Agent Infrastructure Layer (6 tables)
  
  1. `agents` - Registry of all autonomous agents
  2. `agent_tools` - Tools available to each agent
  3. `agent_ontologies` - Domain knowledge and capabilities
  4. `agent_sessions` - Isolated execution contexts per user
  5. `agent_memory` - Four-part memory system with vector embeddings
  6. `message_bus` - Async inter-agent communication queue
  
  ## Orchestration Layer (3 tables)
  
  7. `workflows` - DAG workflow definitions
  8. `workflow_executions` - Runtime execution tracking
  9. `task_queue` - Agent task assignments
  
  ## Governance Layer (3 tables)
  
  10. `agent_audit_log` - Complete execution trace with reasoning
  11. `agent_metrics` - Performance tracking (tokens, latency, cost)
  12. `policy_rules` - Access control and rate limiting
  
  ## Value Engineering Domain (6 tables)
  
  13. `value_cases` - Top-level value case orchestration
  14. `company_profiles` - Company and industry intelligence
  15. `value_maps` - Feature-to-outcome value chains
  16. `kpi_hypotheses` - Baseline and target KPIs
  17. `financial_models` - ROI, NPV, payback calculations
  18. `assumptions` - Provenance tracking for all claims
  
  ## Security
  
  - All tables have Row Level Security (RLS) enabled
  - Data scoped to user sessions
  - Complete audit trail for compliance
  - Immutable event stream for provenance
*/

-- Enable pgvector extension for semantic memory
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- AGENT INFRASTRUCTURE LAYER (6 tables)
-- =====================================================

-- 1. Agents Registry
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL,
  description text,
  capabilities jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Agent Tools
CREATE TABLE IF NOT EXISTS agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  tool_schema jsonb NOT NULL,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Agent Ontologies
CREATE TABLE IF NOT EXISTS agent_ontologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  domain text NOT NULL,
  knowledge jsonb NOT NULL,
  version integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 4. Agent Sessions
CREATE TABLE IF NOT EXISTS agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text UNIQUE NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'cancelled')),
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 5. Agent Memory (Four-part memory system)
CREATE TABLE IF NOT EXISTS agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES agent_sessions(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  memory_type text NOT NULL CHECK (memory_type IN ('episodic', 'semantic', 'working', 'procedural')),
  content text NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,
  importance_score float DEFAULT 0.5,
  created_at timestamptz DEFAULT now(),
  accessed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_session ON agent_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding ON agent_memory USING ivfflat (embedding vector_cosine_ops);

-- 6. Message Bus
CREATE TABLE IF NOT EXISTS message_bus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES agent_sessions(id) ON DELETE CASCADE,
  from_agent_id uuid REFERENCES agents(id),
  to_agent_id uuid REFERENCES agents(id),
  message_type text NOT NULL CHECK (message_type IN ('task_assignment', 'task_result', 'status_event', 'audit_event')),
  payload jsonb NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority integer DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_message_bus_session ON message_bus(session_id);
CREATE INDEX IF NOT EXISTS idx_message_bus_status ON message_bus(status) WHERE status = 'pending';

-- =====================================================
-- ORCHESTRATION LAYER (3 tables)
-- =====================================================

-- 7. Workflows (DAG definitions)
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  dag_definition jsonb NOT NULL,
  version integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 8. Workflow Executions
CREATE TABLE IF NOT EXISTS workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  session_id uuid REFERENCES agent_sessions(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  current_step text,
  dag_state jsonb DEFAULT '{}'::jsonb,
  error_message text,
  quality_score float,
  iteration_count integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_session ON workflow_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);

-- 9. Task Queue
CREATE TABLE IF NOT EXISTS task_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_id uuid REFERENCES workflow_executions(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id),
  task_type text NOT NULL,
  input_data jsonb NOT NULL,
  output_data jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'running', 'completed', 'failed', 'retry')),
  priority integer DEFAULT 5,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_task_queue_workflow ON task_queue(workflow_execution_id);
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status) WHERE status IN ('pending', 'assigned');

-- =====================================================
-- GOVERNANCE LAYER (3 tables)
-- =====================================================

-- 10. Agent Audit Log
CREATE TABLE IF NOT EXISTS agent_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES agent_sessions(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id),
  action text NOT NULL,
  reasoning text,
  input_data jsonb,
  output_data jsonb,
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low')),
  evidence jsonb DEFAULT '[]'::jsonb,
  timestamp timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_log_session ON agent_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON agent_audit_log(timestamp);

-- 11. Agent Metrics
CREATE TABLE IF NOT EXISTS agent_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES agent_sessions(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id),
  metric_type text NOT NULL,
  metric_value float NOT NULL,
  unit text,
  timestamp timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_session ON agent_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_type ON agent_metrics(metric_type);

-- 12. Policy Rules
CREATE TABLE IF NOT EXISTS policy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL UNIQUE,
  rule_type text NOT NULL CHECK (rule_type IN ('rate_limit', 'access_control', 'data_residency', 'compliance')),
  rule_definition jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- VALUE ENGINEERING DOMAIN (6 tables)
-- =====================================================

-- 13. Value Cases
CREATE TABLE IF NOT EXISTS value_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES agent_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  company_profile_id uuid,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published')),
  quality_score float,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_value_cases_session ON value_cases(session_id);

-- 14. Company Profiles
CREATE TABLE IF NOT EXISTS company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id uuid REFERENCES value_cases(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  industry text,
  vertical text,
  company_size text,
  buyer_persona jsonb,
  pain_points jsonb DEFAULT '[]'::jsonb,
  current_state jsonb,
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 15. Value Maps
CREATE TABLE IF NOT EXISTS value_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id uuid REFERENCES value_cases(id) ON DELETE CASCADE,
  feature text NOT NULL,
  capability text NOT NULL,
  business_outcome text NOT NULL,
  value_driver text NOT NULL,
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low')),
  supporting_evidence jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 16. KPI Hypotheses
CREATE TABLE IF NOT EXISTS kpi_hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id uuid REFERENCES value_cases(id) ON DELETE CASCADE,
  kpi_name text NOT NULL,
  baseline_value float,
  target_value float,
  unit text,
  timeframe text,
  calculation_method text,
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low')),
  assumptions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 17. Financial Models
CREATE TABLE IF NOT EXISTS financial_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id uuid REFERENCES value_cases(id) ON DELETE CASCADE,
  roi_percentage float,
  npv_amount float,
  payback_months integer,
  total_investment float,
  total_benefit float,
  cost_breakdown jsonb,
  benefit_breakdown jsonb,
  sensitivity_analysis jsonb,
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 18. Assumptions (Provenance tracking)
CREATE TABLE IF NOT EXISTS assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id uuid REFERENCES value_cases(id) ON DELETE CASCADE,
  related_table text NOT NULL,
  related_id uuid NOT NULL,
  assumption_type text NOT NULL,
  assumption_text text NOT NULL,
  source text,
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low')),
  validation_status text DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'rejected', 'needs_review')),
  evidence jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assumptions_value_case ON assumptions(value_case_id);
CREATE INDEX IF NOT EXISTS idx_assumptions_related ON assumptions(related_table, related_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_ontologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_bus ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE assumptions ENABLE ROW LEVEL SECURITY;

-- System tables accessible to all (agents, workflows, policy_rules)
CREATE POLICY "Allow read access to agents"
  ON agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read access to workflows"
  ON workflows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read access to policy rules"
  ON policy_rules FOR SELECT
  TO authenticated
  USING (true);

-- Session-scoped tables
CREATE POLICY "Users can manage own sessions"
  ON agent_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own session memory"
  ON agent_memory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_sessions
      WHERE agent_sessions.id = agent_memory.session_id
      AND agent_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own session messages"
  ON message_bus FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_sessions
      WHERE agent_sessions.id = message_bus.session_id
      AND agent_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own workflow executions"
  ON workflow_executions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_sessions
      WHERE agent_sessions.id = workflow_executions.session_id
      AND agent_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own tasks"
  ON task_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workflow_executions
      JOIN agent_sessions ON agent_sessions.id = workflow_executions.session_id
      WHERE workflow_executions.id = task_queue.workflow_execution_id
      AND agent_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own audit logs"
  ON agent_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_sessions
      WHERE agent_sessions.id = agent_audit_log.session_id
      AND agent_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own metrics"
  ON agent_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_sessions
      WHERE agent_sessions.id = agent_metrics.session_id
      AND agent_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own value cases"
  ON value_cases FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_sessions
      WHERE agent_sessions.id = value_cases.session_id
      AND agent_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_sessions
      WHERE agent_sessions.id = value_cases.session_id
      AND agent_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own company profiles"
  ON company_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM value_cases
      JOIN agent_sessions ON agent_sessions.id = value_cases.session_id
      WHERE value_cases.id = company_profiles.value_case_id
      AND agent_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own value maps"
  ON value_maps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM value_cases
      JOIN agent_sessions ON agent_sessions.id = value_cases.session_id
      WHERE value_cases.id = value_maps.value_case_id
      AND agent_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own kpi hypotheses"
  ON kpi_hypotheses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM value_cases
      JOIN agent_sessions ON agent_sessions.id = value_cases.session_id
      WHERE value_cases.id = kpi_hypotheses.value_case_id
      AND agent_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own financial models"
  ON financial_models FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM value_cases
      JOIN agent_sessions ON agent_sessions.id = value_cases.session_id
      WHERE value_cases.id = financial_models.value_case_id
      AND agent_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own assumptions"
  ON assumptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM value_cases
      JOIN agent_sessions ON agent_sessions.id = value_cases.session_id
      WHERE value_cases.id = assumptions.value_case_id
      AND agent_sessions.user_id = auth.uid()
    )
  );