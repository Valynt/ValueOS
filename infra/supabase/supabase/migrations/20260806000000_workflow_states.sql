-- Migration: workflow_states
-- Creates the workflow_states table used by WorkflowStateRepository and SupabaseSagaPersistence.
-- Tenant isolation enforced via organization_id on every row and RLS policies.

CREATE TABLE IF NOT EXISTS public.workflow_states (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       text        NOT NULL,
  execution_id      text        NOT NULL,
  workspace_id      text        NOT NULL,
  organization_id   uuid        NOT NULL,
  lifecycle_stage   text        NOT NULL DEFAULT '',
  status            text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','completed','failed','cancelled','paused','rolled_back','waiting_approval')),
  current_step      text        NOT NULL DEFAULT '',
  completed_steps   text[]      NOT NULL DEFAULT '{}',
  state_data        jsonb       NOT NULL DEFAULT '{}',
  context           jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the most common query patterns
CREATE INDEX IF NOT EXISTS workflow_states_organization_id_idx
  ON public.workflow_states (organization_id);

CREATE INDEX IF NOT EXISTS workflow_states_execution_id_idx
  ON public.workflow_states (execution_id);

CREATE INDEX IF NOT EXISTS workflow_states_workflow_id_org_idx
  ON public.workflow_states (workflow_id, organization_id);

CREATE INDEX IF NOT EXISTS workflow_states_status_idx
  ON public.workflow_states (status)
  WHERE status IN ('pending', 'running', 'waiting_approval');

-- Auto-update updated_at on every row mutation
CREATE OR REPLACE FUNCTION public.set_workflow_states_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER workflow_states_updated_at
  BEFORE UPDATE ON public.workflow_states
  FOR EACH ROW EXECUTE FUNCTION public.set_workflow_states_updated_at();

-- Row-Level Security
ALTER TABLE public.workflow_states ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant members can read their own org's workflow states
CREATE POLICY "workflow_states_select"
  ON public.workflow_states
  FOR SELECT
  USING (security.user_has_tenant_access(organization_id));

-- INSERT: tenant members can create workflow states for their org
CREATE POLICY "workflow_states_insert"
  ON public.workflow_states
  FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id));

-- UPDATE: tenant members can update their own org's workflow states
CREATE POLICY "workflow_states_update"
  ON public.workflow_states
  FOR UPDATE
  USING (security.user_has_tenant_access(organization_id))
  WITH CHECK (security.user_has_tenant_access(organization_id));

-- DELETE: tenant members can delete their own org's workflow states
CREATE POLICY "workflow_states_delete"
  ON public.workflow_states
  FOR DELETE
  USING (security.user_has_tenant_access(organization_id));

-- Grant access to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_states TO authenticated;
