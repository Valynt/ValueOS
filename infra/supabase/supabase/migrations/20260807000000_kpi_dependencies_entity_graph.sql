-- ============================================================================
-- Migration: kpi_dependencies + entity_graph_edges
--
-- Enables Tier 2 VML Entity Graph: Account → KPI → NPV dependency chains
-- that propagate value changes through the graph.
-- ============================================================================

-- ============================================================================
-- 1. kpi_dependencies — directed edges between KPIs within a value case
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.kpi_dependencies (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        text        NOT NULL,
  value_case_id    uuid        NOT NULL,
  source_kpi_id    uuid        NOT NULL,
  target_kpi_id    uuid        NOT NULL,
  weight           numeric(7,4) NOT NULL DEFAULT 1.0
    CHECK (weight >= 0 AND weight <= 100),
  propagation_type text        NOT NULL DEFAULT 'linear'
    CHECK (propagation_type IN ('linear', 'multiplicative', 'threshold', 'custom')),
  lag_periods      integer     NOT NULL DEFAULT 0
    CHECK (lag_periods >= 0),
  metadata         jsonb       DEFAULT '{}'::jsonb,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  CONSTRAINT kpi_dep_no_self_loop CHECK (source_kpi_id <> target_kpi_id),
  CONSTRAINT kpi_dep_unique_edge  UNIQUE (value_case_id, source_kpi_id, target_kpi_id)
);

CREATE INDEX IF NOT EXISTS idx_kpi_deps_tenant
  ON public.kpi_dependencies (tenant_id);
CREATE INDEX IF NOT EXISTS idx_kpi_deps_value_case
  ON public.kpi_dependencies (value_case_id);
CREATE INDEX IF NOT EXISTS idx_kpi_deps_source
  ON public.kpi_dependencies (source_kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_deps_target
  ON public.kpi_dependencies (target_kpi_id);

ALTER TABLE public.kpi_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY kpi_dependencies_tenant_select ON public.kpi_dependencies
  FOR SELECT USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY kpi_dependencies_tenant_insert ON public.kpi_dependencies
  FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY kpi_dependencies_tenant_update ON public.kpi_dependencies
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY kpi_dependencies_tenant_delete ON public.kpi_dependencies
  FOR DELETE USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY kpi_dependencies_service_role ON public.kpi_dependencies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_dependencies TO authenticated;
GRANT ALL ON public.kpi_dependencies TO service_role;

-- ============================================================================
-- 2. entity_graph_edges — generalised entity-level dependency graph
--    Supports Account → KPI, KPI → FinancialModel (NPV), etc.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.entity_graph_edges (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        text        NOT NULL,
  value_case_id    uuid        NOT NULL,
  source_type      text        NOT NULL
    CHECK (source_type IN ('account', 'kpi', 'financial_model', 'value_driver', 'assumption')),
  source_id        uuid        NOT NULL,
  target_type      text        NOT NULL
    CHECK (target_type IN ('account', 'kpi', 'financial_model', 'value_driver', 'assumption')),
  target_id        uuid        NOT NULL,
  edge_type        text        NOT NULL DEFAULT 'depends_on'
    CHECK (edge_type IN ('depends_on', 'drives', 'constrains', 'validates')),
  weight           numeric(7,4) NOT NULL DEFAULT 1.0,
  metadata         jsonb       DEFAULT '{}'::jsonb,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  CONSTRAINT entity_edge_no_self CHECK (
    NOT (source_type = target_type AND source_id = target_id)
  ),
  CONSTRAINT entity_edge_unique UNIQUE (value_case_id, source_type, source_id, target_type, target_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_entity_graph_tenant
  ON public.entity_graph_edges (tenant_id);
CREATE INDEX IF NOT EXISTS idx_entity_graph_value_case
  ON public.entity_graph_edges (value_case_id);
CREATE INDEX IF NOT EXISTS idx_entity_graph_source
  ON public.entity_graph_edges (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_entity_graph_target
  ON public.entity_graph_edges (target_type, target_id);

ALTER TABLE public.entity_graph_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_graph_edges_tenant_select ON public.entity_graph_edges
  FOR SELECT USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY entity_graph_edges_tenant_insert ON public.entity_graph_edges
  FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY entity_graph_edges_tenant_update ON public.entity_graph_edges
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY entity_graph_edges_tenant_delete ON public.entity_graph_edges
  FOR DELETE USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY entity_graph_edges_service_role ON public.entity_graph_edges
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_graph_edges TO authenticated;
GRANT ALL ON public.entity_graph_edges TO service_role;

-- ============================================================================
-- 3. updated_at trigger for both tables
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kpi_dependencies_updated_at ON public.kpi_dependencies;
CREATE TRIGGER trg_kpi_dependencies_updated_at
  BEFORE UPDATE ON public.kpi_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_entity_graph_edges_updated_at ON public.entity_graph_edges;
CREATE TRIGGER trg_entity_graph_edges_updated_at
  BEFORE UPDATE ON public.entity_graph_edges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
