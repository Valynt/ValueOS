-- Core workflow tables for the agentic value-case path.
-- Covers: hypothesis outputs, value tree nodes, financial model snapshots,
-- and workflow checkpoints (required by HumanCheckpointService).

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. hypothesis_outputs
-- Stores OpportunityAgent results per case run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hypothesis_outputs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           uuid        NOT NULL,
  organization_id   uuid        NOT NULL,
  agent_run_id      uuid,
  hypotheses        jsonb       NOT NULL DEFAULT '[]',
  kpis              jsonb       NOT NULL DEFAULT '[]',
  confidence        text        CHECK (confidence IN ('high', 'medium', 'low')),
  reasoning         text,
  hallucination_check boolean,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hypothesis_outputs_case_id
  ON public.hypothesis_outputs (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hypothesis_outputs_org_id
  ON public.hypothesis_outputs (organization_id);

ALTER TABLE public.hypothesis_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY hypothesis_outputs_tenant_select
  ON public.hypothesis_outputs FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY hypothesis_outputs_tenant_insert
  ON public.hypothesis_outputs FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY hypothesis_outputs_tenant_update
  ON public.hypothesis_outputs FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY hypothesis_outputs_tenant_delete
  ON public.hypothesis_outputs FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 2. value_tree_nodes
-- Stores the editable value driver tree for a case.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.value_tree_nodes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid        NOT NULL,
  organization_id uuid        NOT NULL,
  parent_id       uuid        REFERENCES public.value_tree_nodes (id) ON DELETE CASCADE,
  label           text        NOT NULL,
  value           numeric,
  unit            text,
  node_type       text        NOT NULL DEFAULT 'driver'
                              CHECK (node_type IN ('root', 'driver', 'assumption', 'kpi')),
  metadata        jsonb       NOT NULL DEFAULT '{}',
  sort_order      integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_value_tree_nodes_case_id
  ON public.value_tree_nodes (case_id);

CREATE INDEX IF NOT EXISTS idx_value_tree_nodes_org_id
  ON public.value_tree_nodes (organization_id);

ALTER TABLE public.value_tree_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY value_tree_nodes_tenant_select
  ON public.value_tree_nodes FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY value_tree_nodes_tenant_insert
  ON public.value_tree_nodes FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY value_tree_nodes_tenant_update
  ON public.value_tree_nodes FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY value_tree_nodes_tenant_delete
  ON public.value_tree_nodes FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 3. financial_model_snapshots
-- Stores FinancialModelingAgent output per case run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.financial_model_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid        NOT NULL,
  organization_id uuid        NOT NULL,
  agent_run_id    uuid,
  roi_percentage  numeric,
  npv             numeric,
  payback_months  integer,
  total_investment numeric,
  total_benefit   numeric,
  currency        text        NOT NULL DEFAULT 'USD',
  time_horizon_months integer,
  sensitivity     jsonb       NOT NULL DEFAULT '{}',
  scenarios       jsonb       NOT NULL DEFAULT '[]',
  assumptions     jsonb       NOT NULL DEFAULT '[]',
  raw_output      jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_model_snapshots_case_id
  ON public.financial_model_snapshots (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_model_snapshots_org_id
  ON public.financial_model_snapshots (organization_id);

ALTER TABLE public.financial_model_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_model_snapshots_tenant_select
  ON public.financial_model_snapshots FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY financial_model_snapshots_tenant_insert
  ON public.financial_model_snapshots FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY financial_model_snapshots_tenant_update
  ON public.financial_model_snapshots FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY financial_model_snapshots_tenant_delete
  ON public.financial_model_snapshots FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 4. workflow_checkpoints
-- Required by HumanCheckpointService and ApprovalWorkflowService.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workflow_checkpoints (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid,
  organization_id uuid        NOT NULL,
  session_id      text        NOT NULL,
  agent_id        text        NOT NULL,
  checkpoint_type text        NOT NULL DEFAULT 'approval'
                              CHECK (checkpoint_type IN ('approval', 'review', 'gate')),
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  payload         jsonb       NOT NULL DEFAULT '{}',
  decision        jsonb,
  decided_by      uuid,
  decided_at      timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_session_id
  ON public.workflow_checkpoints (session_id, status);

CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_org_id
  ON public.workflow_checkpoints (organization_id, status);

ALTER TABLE public.workflow_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_checkpoints_tenant_select
  ON public.workflow_checkpoints FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY workflow_checkpoints_tenant_insert
  ON public.workflow_checkpoints FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY workflow_checkpoints_tenant_update
  ON public.workflow_checkpoints FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY workflow_checkpoints_tenant_delete
  ON public.workflow_checkpoints FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));
