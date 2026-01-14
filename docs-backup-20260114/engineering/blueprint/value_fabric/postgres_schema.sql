-- PostgreSQL schema for the Value Fabric

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS business_objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    priority SMALLINT CHECK (priority >= 1 AND priority <= 5),
    owner TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT[]
);

CREATE TABLE IF NOT EXISTS use_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS use_case_capabilities (
    use_case_id UUID REFERENCES use_cases(id) ON DELETE CASCADE,
    capability_id UUID REFERENCES capabilities(id) ON DELETE CASCADE,
    PRIMARY KEY (use_case_id, capability_id)
);

CREATE TABLE IF NOT EXISTS kpis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    measurement TEXT CHECK (measurement IN ('percentage','currency','time','count')),
    target_direction TEXT CHECK (target_direction IN ('increase','decrease'))
);

CREATE TABLE IF NOT EXISTS use_case_kpis (
    use_case_id UUID REFERENCES use_cases(id) ON DELETE CASCADE,
    kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
    PRIMARY KEY (use_case_id, kpi_id)
);

CREATE TABLE IF NOT EXISTS financial_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('revenue','cost','risk')),
    currency CHAR(3),
    unit TEXT
);

CREATE TABLE IF NOT EXISTS kpi_financial_metrics (
    kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
    financial_metric_id UUID REFERENCES financial_metrics(id) ON DELETE CASCADE,
    PRIMARY KEY (kpi_id, financial_metric_id)
);

-- Value Trees and their nodes
CREATE TABLE IF NOT EXISTS value_trees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    use_case_id UUID REFERENCES use_cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS value_tree_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    value_tree_id UUID REFERENCES value_trees(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    type TEXT CHECK (type IN ('capability','outcome','kpi','financialMetric')),
    UNIQUE (value_tree_id, label)
);

CREATE TABLE IF NOT EXISTS value_tree_links (
    parent_id UUID REFERENCES value_tree_nodes(id) ON DELETE CASCADE,
    child_id UUID REFERENCES value_tree_nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (parent_id, child_id)
);

-- ROI Models
CREATE TABLE IF NOT EXISTS roi_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    value_tree_id UUID REFERENCES value_trees(id) ON DELETE CASCADE,
    assumptions TEXT[],
    version TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roi_model_calculations (
    id SERIAL PRIMARY KEY,
    roi_model_id UUID REFERENCES roi_models(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    formula TEXT NOT NULL,
    description TEXT
);

-- Benchmarks
CREATE TABLE IF NOT EXISTS benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
    industry TEXT,
    region TEXT,
    value DOUBLE PRECISION,
    unit TEXT
);

-- Value Commit (Target)
CREATE TABLE IF NOT EXISTS value_commits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    value_tree_id UUID REFERENCES value_trees(id) ON DELETE CASCADE,
    committed_by TEXT,
    date_committed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kpi_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    value_commit_id UUID REFERENCES value_commits(id) ON DELETE CASCADE,
    kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
    target_value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL,
    deadline DATE
);

-- Telemetry Events
CREATE TABLE IF NOT EXISTS telemetry_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_telemetry_kpi_timestamp ON telemetry_events (kpi_id, timestamp);

-- Realization Reports
CREATE TABLE IF NOT EXISTS realization_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    value_commit_id UUID REFERENCES value_commits(id) ON DELETE CASCADE,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS realization_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    realization_report_id UUID REFERENCES realization_reports(id) ON DELETE CASCADE,
    kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
    actual_value DOUBLE PRECISION NOT NULL,
    target_value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL,
    variance DOUBLE PRECISION
);

-- Expansion Models
CREATE TABLE IF NOT EXISTS expansion_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    value_tree_id UUID REFERENCES value_trees(id) ON DELETE CASCADE,
    executive_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expansion_improvements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expansion_model_id UUID REFERENCES expansion_models(id) ON DELETE CASCADE,
    kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
    incremental_value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL,
    confidence DOUBLE PRECISION CHECK (confidence >= 0 AND confidence <= 1)
);

-- Triggers to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_business_objectives
BEFORE UPDATE ON business_objectives
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_update_capabilities
BEFORE UPDATE ON capabilities
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_update_use_cases
BEFORE UPDATE ON use_cases
FOR EACH ROW EXECUTE FUNCTION update_updated_at();