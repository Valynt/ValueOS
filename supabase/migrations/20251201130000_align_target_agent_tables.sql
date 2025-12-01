-- Migration to align database schema with TargetAgent code.
-- Renames 'models' to 'roi_models' and 'kpis' to 'kpi_targets'.

-- It is generally safer to create new tables and migrate data,
-- but for this greenfield project, a rename is acceptable.

ALTER TABLE "models" RENAME TO "roi_models";
ALTER TABLE "kpis" RENAME TO "kpi_targets";

-- Also, the TargetAgent code uses a 'value_trees' table.
-- The original migration did not create this. We will add it now.
CREATE TABLE value_trees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    value_case_id UUID NOT NULL,
    use_case_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INT DEFAULT 1,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE value_tree_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    value_tree_id UUID NOT NULL REFERENCES value_trees(id) ON DELETE CASCADE,
    node_id VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    reference_id UUID,
    properties JSONB DEFAULT '{}'::JSONB,
    position_x REAL,
    position_y REAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(value_tree_id, node_id)
);

CREATE TABLE value_tree_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    value_tree_id UUID NOT NULL REFERENCES value_trees(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES value_tree_nodes(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES value_tree_nodes(id) ON DELETE CASCADE,
    link_type VARCHAR(50) NOT NULL,
    weight REAL DEFAULT 1.0,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roi_model_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    roi_model_id UUID NOT NULL REFERENCES roi_models(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    formula TEXT,
    description TEXT,
    calculation_order INT,
    result_type VARCHAR(50),
    unit VARCHAR(50),
    input_variables JSONB,
    source_references JSONB,
    reasoning_trace TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE value_commits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    value_tree_id UUID NOT NULL REFERENCES value_trees(id) ON DELETE CASCADE,
    value_case_id UUID NOT NULL,
    committed_by UUID,
    committed_by_name VARCHAR(255),
    status VARCHAR(50),
    date_committed TIMESTAMP WITH TIME ZONE,
    target_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Apply RLS policies to the new tables
ALTER TABLE value_trees ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_value_trees ON value_trees
  USING (organization_id = auth.get_current_org_id());

ALTER TABLE value_tree_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_value_tree_nodes ON value_tree_nodes
  USING (organization_id = auth.get_current_org_id());

ALTER TABLE value_tree_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_value_tree_links ON value_tree_links
  USING (organization_id = auth.get_current_org_id());
  
ALTER TABLE roi_model_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_roi_model_calculations ON roi_model_calculations
  USING (organization_id = auth.get_current_org_id());

ALTER TABLE value_commits ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_value_commits ON value_commits
  USING (organization_id = auth.get_current_org_id());
  
-- The original 'roi_models' table was called 'models'. Let's ensure it has the correct columns.
-- The agent code expects 'value_tree_id'. The original schema did not have this.
ALTER TABLE roi_models ADD COLUMN IF NOT EXISTS value_tree_id UUID;
ALTER TABLE roi_models ADD COLUMN IF NOT EXISTS financial_model_id UUID;
ALTER TABLE roi_models ADD COLUMN IF NOT EXISTS assumptions TEXT[];
ALTER TABLE roi_models ADD COLUMN IF NOT EXISTS confidence_level VARCHAR(50);
ALTER TABLE roi_models ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;


-- The original 'kpi_targets' table was called 'kpis'. Let's ensure it has the correct columns.
ALTER TABLE kpi_targets ADD COLUMN IF NOT EXISTS value_commit_id UUID;
ALTER TABLE kpi_targets ADD COLUMN IF NOT EXISTS kpi_hypothesis_id UUID;
ALTER TABLE kpi_targets ADD COLUMN IF NOT EXISTS kpi_name VARCHAR(255);
ALTER TABLE kpi_targets ADD COLUMN IF NOT EXISTS deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE kpi_targets ADD COLUMN IF NOT EXISTS confidence_level VARCHAR(50);
ALTER TABLE kpi_targets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Apply RLS policy to the renamed tables
ALTER TABLE roi_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_roi_models ON roi_models
  USING (organization_id = auth.get_current_org_id());
  
ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_kpi_targets ON kpi_targets
  USING (organization_id = auth.get_current_org_id());

