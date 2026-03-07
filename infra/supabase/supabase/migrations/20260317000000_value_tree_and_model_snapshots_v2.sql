-- Sprint 4: Extend value_tree_nodes and financial_model_snapshots with
-- columns needed by TargetAgent and FinancialModelingAgent persistence.
--
-- value_tree_nodes gains: node_key, description, driver_type, impact_estimate,
--   confidence, source_agent (Sprint 1 had label/value/unit/node_type/metadata).
-- financial_model_snapshots gains: snapshot_version, assumptions_json,
--   outputs_json, source_agent (Sprint 1 had roi_percentage/npv/payback_months etc).
-- Both tables gain a composite (case_id, organization_id) index for hot reads.

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. Extend value_tree_nodes
-- ============================================================================

ALTER TABLE public.value_tree_nodes
  ADD COLUMN IF NOT EXISTS node_key        text,
  ADD COLUMN IF NOT EXISTS description     text,
  ADD COLUMN IF NOT EXISTS driver_type     text
    CHECK (driver_type IN ('revenue', 'cost', 'efficiency', 'risk', 'other')),
  ADD COLUMN IF NOT EXISTS impact_estimate numeric,
  ADD COLUMN IF NOT EXISTS confidence      numeric
    CHECK (confidence >= 0 AND confidence <= 1),
  ADD COLUMN IF NOT EXISTS source_agent    text;

-- Composite index for the hot read path: all nodes for a case scoped to tenant
CREATE INDEX IF NOT EXISTS idx_value_tree_nodes_case_org
  ON public.value_tree_nodes (case_id, organization_id, sort_order ASC);

-- ============================================================================
-- 2. Extend financial_model_snapshots
-- ============================================================================

ALTER TABLE public.financial_model_snapshots
  ADD COLUMN IF NOT EXISTS snapshot_version  integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assumptions_json  jsonb   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS outputs_json      jsonb   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_agent      text;

-- Composite index for latest-snapshot query
CREATE INDEX IF NOT EXISTS idx_financial_model_snapshots_case_org_created
  ON public.financial_model_snapshots (case_id, organization_id, created_at DESC);

-- Auto-increment snapshot_version per (case_id, organization_id).
-- Uses a sequence-free approach: MAX(snapshot_version) + 1 at insert time.
-- The repository layer handles this; no DB trigger needed.
