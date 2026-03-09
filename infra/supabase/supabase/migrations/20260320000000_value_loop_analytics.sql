-- Value loop analytics events
--
-- Tracks recommendation acceptance, assumption corrections, and evidence
-- persuasiveness to feed learning loops back into the agent system.
-- All rows are tenant-scoped via organization_id.

CREATE TABLE IF NOT EXISTS public.value_loop_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  session_id      text NOT NULL,
  event_type      text NOT NULL
    CHECK (event_type IN (
      'recommendation_accepted',
      'recommendation_dismissed',
      'assumption_corrected',
      'evidence_accepted',
      'evidence_rejected'
    )),
  -- The domain object this event relates to (hypothesis, assumption, evidence, etc.)
  object_type     text,
  object_id       uuid,
  -- Structured payload — agent name, confidence, correction delta, etc.
  payload         jsonb NOT NULL DEFAULT '{}',
  actor_id        uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vle_org_type
  ON public.value_loop_events (organization_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vle_session
  ON public.value_loop_events (session_id, created_at DESC);

ALTER TABLE public.value_loop_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY vle_tenant_select
  ON public.value_loop_events FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY vle_tenant_insert
  ON public.value_loop_events FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

-- Agents write via service_role (no RLS bypass needed for reads)
GRANT SELECT, INSERT ON public.value_loop_events TO authenticated;
