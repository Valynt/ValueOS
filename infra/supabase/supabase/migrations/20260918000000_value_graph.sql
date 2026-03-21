-- Migration: value_graph
-- Canonical Value Graph ontology tables for Sprint 47.
--
-- Four new tables form the graph layer that connects customer use cases to
-- quantified economic outcomes:
--
--   vg_capabilities     — what a product enables operationally
--   vg_metrics          — quantifiable outcomes a capability impacts
--   vg_value_drivers    — economic categories (fixed EVF taxonomy)
--   value_graph_edges   — typed, weighted, evidence-linked relationships
--
-- All tables use organization_id (not tenant_id) to align with the newer
-- domain model. The existing value_drivers table (tenant_id, formula-based)
-- is a separate concept and is not replaced by this migration.
--
-- Ontology version 1.0. Edge types and value driver taxonomy are locked at
-- this version. Agents must record ontology_version on every write.

SET search_path = public, pg_temp;

-- ============================================================
-- 1. vg_capabilities
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vg_capabilities (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID        NOT NULL,
    opportunity_id   UUID        NOT NULL,
    name             TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
    description      TEXT        NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
    category         TEXT        NOT NULL CHECK (category IN (
                                     'automation', 'analytics', 'integration',
                                     'collaboration', 'security', 'compliance',
                                     'ai_ml', 'infrastructure', 'other'
                                 )),
    ontology_version TEXT        NOT NULL DEFAULT '1.0',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vg_capabilities_org_opp
    ON public.vg_capabilities (organization_id, opportunity_id);

CREATE INDEX IF NOT EXISTS idx_vg_capabilities_org_id
    ON public.vg_capabilities (organization_id);

ALTER TABLE public.vg_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vg_capabilities_select"
    ON public.vg_capabilities
    FOR SELECT
    USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "vg_capabilities_insert"
    ON public.vg_capabilities
    FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "vg_capabilities_update"
    ON public.vg_capabilities
    FOR UPDATE
    USING (security.user_has_tenant_access(organization_id::text))
    WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "vg_capabilities_delete"
    ON public.vg_capabilities
    FOR DELETE
    USING (security.user_has_tenant_access(organization_id::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vg_capabilities TO authenticated;
GRANT ALL ON public.vg_capabilities TO service_role;

-- ============================================================
-- 2. vg_metrics
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vg_metrics (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id          UUID        NOT NULL,
    opportunity_id           UUID        NOT NULL,
    name                     TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
    unit                     TEXT        NOT NULL CHECK (unit IN (
                                             'usd', 'percent', 'hours', 'headcount',
                                             'days', 'count', 'score'
                                         )),
    baseline_value           NUMERIC,
    target_value             NUMERIC,
    measurement_method       TEXT        CHECK (char_length(measurement_method) <= 1000),
    impact_timeframe_months  INTEGER     CHECK (impact_timeframe_months > 0),
    ontology_version         TEXT        NOT NULL DEFAULT '1.0',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vg_metrics_org_opp
    ON public.vg_metrics (organization_id, opportunity_id);

CREATE INDEX IF NOT EXISTS idx_vg_metrics_org_id
    ON public.vg_metrics (organization_id);

ALTER TABLE public.vg_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vg_metrics_select"
    ON public.vg_metrics
    FOR SELECT
    USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "vg_metrics_insert"
    ON public.vg_metrics
    FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "vg_metrics_update"
    ON public.vg_metrics
    FOR UPDATE
    USING (security.user_has_tenant_access(organization_id::text))
    WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "vg_metrics_delete"
    ON public.vg_metrics
    FOR DELETE
    USING (security.user_has_tenant_access(organization_id::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vg_metrics TO authenticated;
GRANT ALL ON public.vg_metrics TO service_role;

-- ============================================================
-- 3. vg_value_drivers
-- ============================================================
-- Fixed EVF taxonomy: revenue_growth | cost_reduction | risk_mitigation | capital_efficiency
-- Agents cannot introduce new driver types without an ontology version bump.

CREATE TABLE IF NOT EXISTS public.vg_value_drivers (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID        NOT NULL,
    opportunity_id        UUID        NOT NULL,
    type                  TEXT        NOT NULL CHECK (type IN (
                                          'revenue_growth', 'cost_reduction',
                                          'risk_mitigation', 'capital_efficiency'
                                      )),
    name                  TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
    description           TEXT        NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
    estimated_impact_usd  NUMERIC,
    ontology_version      TEXT        NOT NULL DEFAULT '1.0',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vg_value_drivers_org_opp
    ON public.vg_value_drivers (organization_id, opportunity_id);

CREATE INDEX IF NOT EXISTS idx_vg_value_drivers_org_id
    ON public.vg_value_drivers (organization_id);

ALTER TABLE public.vg_value_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vg_value_drivers_select"
    ON public.vg_value_drivers
    FOR SELECT
    USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "vg_value_drivers_insert"
    ON public.vg_value_drivers
    FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "vg_value_drivers_update"
    ON public.vg_value_drivers
    FOR UPDATE
    USING (security.user_has_tenant_access(organization_id::text))
    WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "vg_value_drivers_delete"
    ON public.vg_value_drivers
    FOR DELETE
    USING (security.user_has_tenant_access(organization_id::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vg_value_drivers TO authenticated;
GRANT ALL ON public.vg_value_drivers TO service_role;

-- ============================================================
-- 4. value_graph_edges
-- ============================================================

CREATE TABLE IF NOT EXISTS public.value_graph_edges (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID        NOT NULL,
    opportunity_id    UUID        NOT NULL,
    from_entity_type  TEXT        NOT NULL CHECK (from_entity_type IN (
                                      'account', 'stakeholder', 'use_case',
                                      'vg_capability', 'vg_metric', 'vg_value_driver',
                                      'evidence', 'value_hypothesis'
                                  )),
    from_entity_id    UUID        NOT NULL,
    to_entity_type    TEXT        NOT NULL CHECK (to_entity_type IN (
                                      'account', 'stakeholder', 'use_case',
                                      'vg_capability', 'vg_metric', 'vg_value_driver',
                                      'evidence', 'value_hypothesis'
                                  )),
    to_entity_id      UUID        NOT NULL,
    edge_type         TEXT        NOT NULL CHECK (edge_type IN (
                                      'company_has_persona',
                                      'persona_executes_use_case',
                                      'use_case_enabled_by_capability',
                                      'capability_impacts_metric',
                                      'metric_maps_to_value_driver',
                                      'evidence_supports_metric',
                                      'hypothesis_claims_value_driver'
                                  )),
    confidence_score  NUMERIC     NOT NULL DEFAULT 0.5
                                  CHECK (confidence_score >= 0 AND confidence_score <= 1),
    evidence_ids      UUID[]      NOT NULL DEFAULT '{}',
    created_by_agent  TEXT        NOT NULL CHECK (char_length(created_by_agent) BETWEEN 1 AND 100),
    ontology_version  TEXT        NOT NULL DEFAULT '1.0',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate edges of the same type between the same pair of typed entities
CREATE UNIQUE INDEX IF NOT EXISTS idx_value_graph_edges_unique_pair
    ON public.value_graph_edges (organization_id, opportunity_id, from_entity_type, from_entity_id, to_entity_type, to_entity_id, edge_type);

CREATE INDEX IF NOT EXISTS idx_value_graph_edges_org_opp
    ON public.value_graph_edges (organization_id, opportunity_id);

CREATE INDEX IF NOT EXISTS idx_value_graph_edges_from
    ON public.value_graph_edges (organization_id, from_entity_type, from_entity_id);

CREATE INDEX IF NOT EXISTS idx_value_graph_edges_to
    ON public.value_graph_edges (organization_id, to_entity_type, to_entity_id);

ALTER TABLE public.value_graph_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "value_graph_edges_select"
    ON public.value_graph_edges
    FOR SELECT
    USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "value_graph_edges_insert"
    ON public.value_graph_edges
    FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "value_graph_edges_update"
    ON public.value_graph_edges
    FOR UPDATE
    USING (security.user_has_tenant_access(organization_id::text))
    WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "value_graph_edges_delete"
    ON public.value_graph_edges
    FOR DELETE
    USING (security.user_has_tenant_access(organization_id::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.value_graph_edges TO authenticated;
GRANT ALL ON public.value_graph_edges TO service_role;
