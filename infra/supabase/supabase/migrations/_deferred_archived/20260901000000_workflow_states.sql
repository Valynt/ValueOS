-- ============================================================================
-- workflow_states — persists HypothesisLoop saga state per value case
--
-- One row per (case_id, organization_id). Updated after every node transition
-- by the ExecutionRuntime. Enables idempotent loop resumption and audit replay.
--
-- Tenant isolation: every row carries organization_id (NOT NULL).
-- RLS: authenticated users read/write only their own tenant's rows.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.workflow_states (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          uuid        NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
  organization_id  uuid        NOT NULL,
  current_stage    text        NOT NULL CHECK (current_stage IN (
    'INITIATED', 'DRAFTING', 'VALIDATING', 'COMPOSING', 'REFINING', 'FINALIZED'
  )),
  status           text        NOT NULL DEFAULT 'running' CHECK (status IN (
    'running', 'paused', 'completed', 'failed'
  )),
  state_data       jsonb       NOT NULL DEFAULT '{}',
  revision_count   integer     NOT NULL DEFAULT 0,
  started_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT workflow_states_case_tenant_unique UNIQUE (case_id, organization_id)
);

-- Index for tenant-scoped queries by status (e.g. list running workflows)
CREATE INDEX IF NOT EXISTS workflow_states_org_status_idx
  ON public.workflow_states (organization_id, status);

-- Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION public.workflow_states_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workflow_states_updated_at ON public.workflow_states;
CREATE TRIGGER workflow_states_updated_at
  BEFORE UPDATE ON public.workflow_states
  FOR EACH ROW EXECUTE FUNCTION public.workflow_states_set_updated_at();

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.workflow_states ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant members read their own rows
CREATE POLICY "workflow_states_select"
  ON public.workflow_states FOR SELECT
  USING (security.user_has_tenant_access(organization_id));

-- INSERT: tenant members create rows for their own tenant
CREATE POLICY "workflow_states_insert"
  ON public.workflow_states FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id));

-- UPDATE: tenant members update their own rows
CREATE POLICY "workflow_states_update"
  ON public.workflow_states FOR UPDATE
  USING (security.user_has_tenant_access(organization_id))
  WITH CHECK (security.user_has_tenant_access(organization_id));

-- DELETE: tenant members delete their own rows
CREATE POLICY "workflow_states_delete"
  ON public.workflow_states FOR DELETE
  USING (security.user_has_tenant_access(organization_id));

-- service_role bypasses RLS for server-side orchestration and cron jobs
GRANT ALL ON public.workflow_states TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_states TO authenticated;

COMMIT;
