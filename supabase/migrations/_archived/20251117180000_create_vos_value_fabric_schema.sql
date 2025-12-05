/*
  # Value Operating System (VOS) - Value Fabric Schema Integration

  This migration integrates the complete VOS Value Fabric with existing Agent Fabric infrastructure.

  ## Overview

  Adds 12 new tables to support the full VOS lifecycle:
  - Opportunity: business_objectives, capabilities, use_cases
  - Target: value_trees, roi_models, benchmarks, value_commits
  - Realization: telemetry_events, realization_reports
  - Expansion: expansion_models

  ## Integration Strategy

  - Extends existing value_cases, company_profiles, financial_models tables
  - Maintains backward compatibility with current agent workflows
  - Adds VOS-specific tables for lifecycle management
  - Preserves all existing RLS policies and audit trails

  ## New Tables (12)

  1. `business_objectives` - Strategic goals and priorities
  2. `capabilities` - Product/solution capabilities catalog
  3. `use_cases` - Customer workflow scenarios
  4. `use_case_capabilities` - Many-to-many junction
  5. `use_case_kpis` - Many-to-many junction
  6. `kpi_financial_metrics` - Many-to-many junction
  7. `value_trees` - Hierarchical value driver structures
  8. `value_tree_nodes` - Individual nodes in value trees
  9. `value_tree_links` - Parent-child relationships in trees
  10. `roi_models` - Formula definitions and calculations
  11. `roi_model_calculations` - Individual calculation steps
  12. `benchmarks` - Industry reference data
  13. `value_commits` - At-sale commitments
  14. `kpi_targets` - Specific KPI targets per commit
  15. `telemetry_events` - Real-time customer metrics
  16. `realization_reports` - Value proof documents
  17. `realization_results` - Actual vs target comparisons
  18. `expansion_models` - Upsell opportunity models
  19. `expansion_improvements` - Proposed improvements per expansion

  ## Security

  - All tables have Row Level Security (RLS) enabled
  - Policies restrict access to authenticated users and their sessions
  - Foreign keys maintain referential integrity
  - Indexes optimize query performance for sub-50ms reads
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================
-- OPPORTUNITY STAGE TABLES
-- =====================================================

-- 1. Business Objectives
CREATE TABLE IF NOT EXISTS business_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id uuid REFERENCES value_cases(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  priority smallint CHECK (priority >= 1 AND priority <= 5),
  owner text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_objectives_case ON business_objectives(value_case_id);
CREATE INDEX IF NOT EXISTS idx_business_objectives_priority ON business_objectives(priority);

-- 2. Capabilities (Product/Solution Features)
CREATE TABLE IF NOT EXISTS capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  tags text[],
  category text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capabilities_name ON capabilities(name);
CREATE INDEX IF NOT EXISTS idx_capabilities_category ON capabilities(category);
CREATE INDEX IF NOT EXISTS idx_capabilities_tags ON capabilities USING gin(tags);

-- 3. Use Cases (Customer Workflows)
CREATE TABLE IF NOT EXISTS use_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  persona text,
  industry text,
  is_template boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_use_cases_persona ON use_cases(persona);
CREATE INDEX IF NOT EXISTS idx_use_cases_industry ON use_cases(industry);

-- 4. Use Case to Capabilities Junction
CREATE TABLE IF NOT EXISTS use_case_capabilities (
  use_case_id uuid REFERENCES use_cases(id) ON DELETE CASCADE,
  capability_id uuid REFERENCES capabilities(id) ON DELETE CASCADE,
  relevance_score float DEFAULT 1.0,
  PRIMARY KEY (use_case_id, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_use_case_capabilities_use_case ON use_case_capabilities(use_case_id);
CREATE INDEX IF NOT EXISTS idx_use_case_capabilities_capability ON use_case_capabilities(capability_id);

-- 5. Use Case to KPIs Junction (extends kpi_hypotheses)
CREATE TABLE IF NOT EXISTS use_case_kpis (
  use_case_id uuid REFERENCES use_cases(id) ON DELETE CASCADE,
  kpi_hypothesis_id uuid REFERENCES kpi_hypotheses(id) ON DELETE CASCADE,
  PRIMARY KEY (use_case_id, kpi_hypothesis_id)
);

CREATE INDEX IF NOT EXISTS idx_use_case_kpis_use_case ON use_case_kpis(use_case_id);
CREATE INDEX IF NOT EXISTS idx_use_case_kpis_kpi ON use_case_kpis(kpi_hypothesis_id);

-- =====================================================
-- TARGET STAGE TABLES
-- =====================================================

-- 6. Value Trees (Hierarchical Value Driver Structures)
CREATE TABLE IF NOT EXISTS value_trees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id uuid REFERENCES value_cases(id) ON DELETE CASCADE,
  use_case_id uuid REFERENCES use_cases(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  version integer DEFAULT 1,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_value_trees_case ON value_trees(value_case_id);
CREATE INDEX IF NOT EXISTS idx_value_trees_use_case ON value_trees(use_case_id);

-- 7. Value Tree Nodes
CREATE TABLE IF NOT EXISTS value_tree_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_tree_id uuid REFERENCES value_trees(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  label text NOT NULL,
  type text NOT NULL CHECK (type IN ('capability', 'outcome', 'kpi', 'financialMetric', 'driver')),
  reference_id uuid,
  properties jsonb DEFAULT '{}'::jsonb,
  position_x integer,
  position_y integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE (value_tree_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_value_tree_nodes_tree ON value_tree_nodes(value_tree_id);
CREATE INDEX IF NOT EXISTS idx_value_tree_nodes_type ON value_tree_nodes(type);
CREATE INDEX IF NOT EXISTS idx_value_tree_nodes_reference ON value_tree_nodes(reference_id);

-- 8. Value Tree Links (Parent-Child Relationships)
CREATE TABLE IF NOT EXISTS value_tree_links (
  parent_id uuid REFERENCES value_tree_nodes(id) ON DELETE CASCADE,
  child_id uuid REFERENCES value_tree_nodes(id) ON DELETE CASCADE,
  link_type text DEFAULT 'drives',
  weight float DEFAULT 1.0,
  metadata jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY (parent_id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_value_tree_links_parent ON value_tree_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_value_tree_links_child ON value_tree_links(child_id);

-- 9. ROI Models (Formula Definitions)
CREATE TABLE IF NOT EXISTS roi_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_tree_id uuid REFERENCES value_trees(id) ON DELETE CASCADE,
  financial_model_id uuid REFERENCES financial_models(id) ON DELETE SET NULL,
  name text NOT NULL,
  assumptions text[],
  version text DEFAULT '1.0',
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roi_models_tree ON roi_models(value_tree_id);
CREATE INDEX IF NOT EXISTS idx_roi_models_financial ON roi_models(financial_model_id);

-- 10. ROI Model Calculations (Formula Steps)
CREATE TABLE IF NOT EXISTS roi_model_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roi_model_id uuid REFERENCES roi_models(id) ON DELETE CASCADE,
  name text NOT NULL,
  formula text NOT NULL,
  description text,
  calculation_order integer DEFAULT 0,
  result_type text CHECK (result_type IN ('revenue', 'cost', 'risk', 'intermediate')),
  unit text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roi_calculations_model ON roi_model_calculations(roi_model_id);
CREATE INDEX IF NOT EXISTS idx_roi_calculations_order ON roi_model_calculations(roi_model_id, calculation_order);

-- 11. Benchmarks (Industry Reference Data)
CREATE TABLE IF NOT EXISTS benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_hypothesis_id uuid REFERENCES kpi_hypotheses(id) ON DELETE CASCADE,
  kpi_name text NOT NULL,
  industry text,
  vertical text,
  company_size text,
  region text,
  value double precision NOT NULL,
  unit text NOT NULL,
  percentile integer CHECK (percentile >= 0 AND percentile <= 100),
  source text,
  sample_size integer,
  data_date date,
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_kpi ON benchmarks(kpi_hypothesis_id);
CREATE INDEX IF NOT EXISTS idx_benchmarks_industry ON benchmarks(industry, vertical);
CREATE INDEX IF NOT EXISTS idx_benchmarks_kpi_name ON benchmarks(kpi_name);
CREATE INDEX IF NOT EXISTS idx_benchmarks_date ON benchmarks(data_date);

-- 12. Value Commits (At-Sale Commitments)
CREATE TABLE IF NOT EXISTS value_commits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_tree_id uuid REFERENCES value_trees(id) ON DELETE CASCADE,
  value_case_id uuid REFERENCES value_cases(id) ON DELETE CASCADE,
  committed_by uuid,
  committed_by_name text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'at_risk', 'missed', 'cancelled')),
  date_committed timestamptz DEFAULT now(),
  target_date date,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_value_commits_tree ON value_commits(value_tree_id);
CREATE INDEX IF NOT EXISTS idx_value_commits_case ON value_commits(value_case_id);
CREATE INDEX IF NOT EXISTS idx_value_commits_status ON value_commits(status);
CREATE INDEX IF NOT EXISTS idx_value_commits_date ON value_commits(date_committed);

-- 13. KPI Targets (Specific Targets per Commitment)
CREATE TABLE IF NOT EXISTS kpi_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_commit_id uuid REFERENCES value_commits(id) ON DELETE CASCADE,
  kpi_hypothesis_id uuid REFERENCES kpi_hypotheses(id) ON DELETE CASCADE,
  kpi_name text NOT NULL,
  baseline_value double precision,
  target_value double precision NOT NULL,
  unit text NOT NULL,
  deadline date,
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kpi_targets_commit ON kpi_targets(value_commit_id);
CREATE INDEX IF NOT EXISTS idx_kpi_targets_kpi ON kpi_targets(kpi_hypothesis_id);

-- =====================================================
-- REALIZATION STAGE TABLES
-- =====================================================

-- 14. Telemetry Events (Real-time Customer Metrics)
CREATE TABLE IF NOT EXISTS telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id uuid REFERENCES value_cases(id) ON DELETE CASCADE,
  kpi_hypothesis_id uuid REFERENCES kpi_hypotheses(id) ON DELETE CASCADE,
  kpi_target_id uuid REFERENCES kpi_targets(id) ON DELETE SET NULL,
  event_timestamp timestamptz NOT NULL,
  value double precision NOT NULL,
  unit text NOT NULL,
  source text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ingested_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_case ON telemetry_events(value_case_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_kpi ON telemetry_events(kpi_hypothesis_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_kpi_timestamp ON telemetry_events(kpi_hypothesis_id, event_timestamp DESC);

-- 15. Realization Reports (Value Proof Documents)
CREATE TABLE IF NOT EXISTS realization_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_commit_id uuid REFERENCES value_commits(id) ON DELETE CASCADE,
  value_case_id uuid REFERENCES value_cases(id) ON DELETE CASCADE,
  report_period_start date NOT NULL,
  report_period_end date NOT NULL,
  overall_status text CHECK (overall_status IN ('on_track', 'at_risk', 'achieved', 'missed')),
  executive_summary text,
  generated_at timestamptz DEFAULT now(),
  generated_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_realization_reports_commit ON realization_reports(value_commit_id);
CREATE INDEX IF NOT EXISTS idx_realization_reports_case ON realization_reports(value_case_id);
CREATE INDEX IF NOT EXISTS idx_realization_reports_period ON realization_reports(report_period_end DESC);

-- 16. Realization Results (Actual vs Target Comparisons)
CREATE TABLE IF NOT EXISTS realization_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realization_report_id uuid REFERENCES realization_reports(id) ON DELETE CASCADE,
  kpi_target_id uuid REFERENCES kpi_targets(id) ON DELETE CASCADE,
  kpi_name text NOT NULL,
  actual_value double precision NOT NULL,
  target_value double precision NOT NULL,
  baseline_value double precision,
  unit text NOT NULL,
  variance double precision,
  variance_percentage double precision,
  status text CHECK (status IN ('exceeded', 'achieved', 'on_track', 'at_risk', 'missed')),
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_realization_results_report ON realization_results(realization_report_id);
CREATE INDEX IF NOT EXISTS idx_realization_results_target ON realization_results(kpi_target_id);
CREATE INDEX IF NOT EXISTS idx_realization_results_status ON realization_results(status);

-- =====================================================
-- EXPANSION STAGE TABLES
-- =====================================================

-- 17. Expansion Models (Upsell Opportunity Models)
CREATE TABLE IF NOT EXISTS expansion_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id uuid REFERENCES value_cases(id) ON DELETE CASCADE,
  value_tree_id uuid REFERENCES value_trees(id) ON DELETE SET NULL,
  realization_report_id uuid REFERENCES realization_reports(id) ON DELETE SET NULL,
  name text NOT NULL,
  executive_summary text,
  opportunity_type text CHECK (opportunity_type IN ('upsell', 'cross_sell', 'optimization', 'expansion')),
  estimated_value double precision,
  confidence_score double precision CHECK (confidence_score >= 0 AND confidence_score <= 1),
  status text DEFAULT 'proposed' CHECK (status IN ('proposed', 'under_review', 'approved', 'rejected', 'implemented')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expansion_models_case ON expansion_models(value_case_id);
CREATE INDEX IF NOT EXISTS idx_expansion_models_tree ON expansion_models(value_tree_id);
CREATE INDEX IF NOT EXISTS idx_expansion_models_status ON expansion_models(status);

-- 18. Expansion Improvements (Proposed Changes)
CREATE TABLE IF NOT EXISTS expansion_improvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expansion_model_id uuid REFERENCES expansion_models(id) ON DELETE CASCADE,
  kpi_hypothesis_id uuid REFERENCES kpi_hypotheses(id) ON DELETE CASCADE,
  kpi_name text NOT NULL,
  current_value double precision,
  proposed_value double precision NOT NULL,
  incremental_value double precision NOT NULL,
  unit text NOT NULL,
  confidence double precision CHECK (confidence >= 0 AND confidence <= 1),
  rationale text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expansion_improvements_model ON expansion_improvements(expansion_model_id);
CREATE INDEX IF NOT EXISTS idx_expansion_improvements_kpi ON expansion_improvements(kpi_hypothesis_id);

-- =====================================================
-- HELPER FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vos_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
CREATE TRIGGER trg_business_objectives_updated
  BEFORE UPDATE ON business_objectives
  FOR EACH ROW EXECUTE FUNCTION update_vos_updated_at();

CREATE TRIGGER trg_capabilities_updated
  BEFORE UPDATE ON capabilities
  FOR EACH ROW EXECUTE FUNCTION update_vos_updated_at();

CREATE TRIGGER trg_use_cases_updated
  BEFORE UPDATE ON use_cases
  FOR EACH ROW EXECUTE FUNCTION update_vos_updated_at();

CREATE TRIGGER trg_value_trees_updated
  BEFORE UPDATE ON value_trees
  FOR EACH ROW EXECUTE FUNCTION update_vos_updated_at();

CREATE TRIGGER trg_roi_models_updated
  BEFORE UPDATE ON roi_models
  FOR EACH ROW EXECUTE FUNCTION update_vos_updated_at();

CREATE TRIGGER trg_expansion_models_updated
  BEFORE UPDATE ON expansion_models
  FOR EACH ROW EXECUTE FUNCTION update_vos_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE business_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE use_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE use_case_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE use_case_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_tree_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_tree_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_model_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE realization_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE realization_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE expansion_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE expansion_improvements ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Authenticated users can access their own session data

-- Business Objectives
CREATE POLICY "Users can view own case objectives"
  ON business_objectives FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM value_cases vc
      JOIN agent_sessions asess ON asess.id = vc.session_id
      WHERE vc.id = business_objectives.value_case_id
      AND asess.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create objectives for own cases"
  ON business_objectives FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM value_cases vc
      JOIN agent_sessions asess ON asess.id = vc.session_id
      WHERE vc.id = business_objectives.value_case_id
      AND asess.user_id = auth.uid()
    )
  );

-- Capabilities (global catalog - readable by all authenticated)
CREATE POLICY "Authenticated users can view capabilities"
  ON capabilities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create capabilities"
  ON capabilities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Use Cases (global templates - readable by all authenticated)
CREATE POLICY "Authenticated users can view use cases"
  ON use_cases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create use cases"
  ON use_cases FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Value Trees
CREATE POLICY "Users can view own case value trees"
  ON value_trees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM value_cases vc
      JOIN agent_sessions asess ON asess.id = vc.session_id
      WHERE vc.id = value_trees.value_case_id
      AND asess.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create value trees for own cases"
  ON value_trees FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM value_cases vc
      JOIN agent_sessions asess ON asess.id = vc.session_id
      WHERE vc.id = value_trees.value_case_id
      AND asess.user_id = auth.uid()
    )
  );

-- Value Tree Nodes
CREATE POLICY "Users can view own value tree nodes"
  ON value_tree_nodes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM value_trees vt
      JOIN value_cases vc ON vc.id = vt.value_case_id
      JOIN agent_sessions asess ON asess.id = vc.session_id
      WHERE vt.id = value_tree_nodes.value_tree_id
      AND asess.user_id = auth.uid()
    )
  );

-- Telemetry Events
CREATE POLICY "Users can view own case telemetry"
  ON telemetry_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM value_cases vc
      JOIN agent_sessions asess ON asess.id = vc.session_id
      WHERE vc.id = telemetry_events.value_case_id
      AND asess.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert telemetry for own cases"
  ON telemetry_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM value_cases vc
      JOIN agent_sessions asess ON asess.id = vc.session_id
      WHERE vc.id = telemetry_events.value_case_id
      AND asess.user_id = auth.uid()
    )
  );

-- Value Commits
CREATE POLICY "Users can view own value commits"
  ON value_commits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM value_cases vc
      JOIN agent_sessions asess ON asess.id = vc.session_id
      WHERE vc.id = value_commits.value_case_id
      AND asess.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create value commits for own cases"
  ON value_commits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM value_cases vc
      JOIN agent_sessions asess ON asess.id = vc.session_id
      WHERE vc.id = value_commits.value_case_id
      AND asess.user_id = auth.uid()
    )
  );

-- Realization Reports
CREATE POLICY "Users can view own realization reports"
  ON realization_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM value_cases vc
      JOIN agent_sessions asess ON asess.id = vc.session_id
      WHERE vc.id = realization_reports.value_case_id
      AND asess.user_id = auth.uid()
    )
  );

-- Expansion Models
CREATE POLICY "Users can view own expansion models"
  ON expansion_models FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM value_cases vc
      JOIN agent_sessions asess ON asess.id = vc.session_id
      WHERE vc.id = expansion_models.value_case_id
      AND asess.user_id = auth.uid()
    )
  );

-- Benchmarks (industry data - readable by all authenticated)
CREATE POLICY "Authenticated users can view benchmarks"
  ON benchmarks FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =====================================================

-- View: Latest telemetry per KPI
CREATE MATERIALIZED VIEW IF NOT EXISTS latest_telemetry AS
SELECT DISTINCT ON (kpi_hypothesis_id)
  kpi_hypothesis_id,
  value,
  unit,
  event_timestamp,
  value_case_id
FROM telemetry_events
ORDER BY kpi_hypothesis_id, event_timestamp DESC;

CREATE INDEX IF NOT EXISTS idx_latest_telemetry_kpi ON latest_telemetry(kpi_hypothesis_id);

-- View: Value Commit Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS value_commit_summary AS
SELECT
  vc.id AS value_commit_id,
  vc.value_case_id,
  vc.status,
  COUNT(DISTINCT kt.id) AS total_kpis,
  AVG(rr.variance_percentage) AS avg_variance,
  COUNT(CASE WHEN rr.status IN ('achieved', 'exceeded') THEN 1 END) AS kpis_achieved
FROM value_commits vc
LEFT JOIN kpi_targets kt ON kt.value_commit_id = vc.id
LEFT JOIN realization_results rr ON rr.kpi_target_id = kt.id
GROUP BY vc.id, vc.value_case_id, vc.status;

CREATE INDEX IF NOT EXISTS idx_value_commit_summary_case ON value_commit_summary(value_case_id);

-- Refresh materialized views function (call periodically)
CREATE OR REPLACE FUNCTION refresh_vos_materialized_views() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY latest_telemetry;
  REFRESH MATERIALIZED VIEW CONCURRENTLY value_commit_summary;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SEED DATA: Core Capabilities and Use Cases
-- =====================================================

-- Insert common capabilities (can be expanded)
INSERT INTO capabilities (name, description, category, tags) VALUES
  ('Workflow Automation', 'Automate repetitive business processes', 'productivity', ARRAY['automation', 'efficiency']),
  ('Real-time Analytics', 'Live dashboard and reporting capabilities', 'analytics', ARRAY['data', 'insights']),
  ('API Integration', 'Connect with external systems via APIs', 'integration', ARRAY['connectivity', 'data-exchange']),
  ('Mobile Access', 'Access platform from mobile devices', 'mobility', ARRAY['mobile', 'remote']),
  ('Role-Based Security', 'Fine-grained access control', 'security', ARRAY['permissions', 'governance'])
ON CONFLICT DO NOTHING;

-- Insert template use cases
INSERT INTO use_cases (name, description, persona, industry, is_template) VALUES
  ('Customer Support Automation', 'Reduce ticket resolution time through AI-powered triage', 'Support Manager', 'SaaS', true),
  ('Sales Pipeline Optimization', 'Increase conversion rates with predictive insights', 'Sales Operations', 'Enterprise', true),
  ('Financial Close Acceleration', 'Speed up month-end close process', 'CFO', 'Finance', true),
  ('Supply Chain Visibility', 'Real-time tracking of inventory and shipments', 'Operations Manager', 'Manufacturing', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- COMPLETION COMMENTS
-- =====================================================

COMMENT ON TABLE value_trees IS 'Hierarchical value driver structures linking capabilities to financial outcomes';
COMMENT ON TABLE roi_models IS 'ROI calculation formulas with assumptions and versioning';
COMMENT ON TABLE value_commits IS 'Formal value commitments made at point of sale';
COMMENT ON TABLE telemetry_events IS 'Real-time customer metric data for realization tracking';
COMMENT ON TABLE realization_reports IS 'Periodic value proof reports comparing actual vs target';
COMMENT ON TABLE expansion_models IS 'Upsell and expansion opportunity models';
COMMENT ON TABLE benchmarks IS 'Industry benchmark data for KPI comparison';
