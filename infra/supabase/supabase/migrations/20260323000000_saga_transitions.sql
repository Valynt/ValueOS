-- Sprint 13: saga_transitions table
-- Provides durable history for ValueCaseSaga state machine transitions.
-- SupabaseSagaPersistence.recordTransition() already writes here; this
-- migration creates the table it expects.

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- saga_transitions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.saga_transitions (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  value_case_id    uuid        NOT NULL,
  organization_id  uuid        NOT NULL,
  from_state       text        NOT NULL,
  to_state         text        NOT NULL,
  trigger          text        NOT NULL,
  agent_id         text,
  correlation_id   uuid        NOT NULL,
  metadata         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT saga_transitions_pkey PRIMARY KEY (id),
  CONSTRAINT saga_transitions_from_state_check CHECK (
    from_state = ANY (ARRAY[
      'INITIATED', 'DRAFTING', 'VALIDATING',
      'COMPOSING', 'REFINING', 'FINALIZED'
    ])
  ),
  CONSTRAINT saga_transitions_to_state_check CHECK (
    to_state = ANY (ARRAY[
      'INITIATED', 'DRAFTING', 'VALIDATING',
      'COMPOSING', 'REFINING', 'FINALIZED'
    ])
  )
);

-- Immutable: no UPDATE or DELETE allowed (append-only audit trail)
ALTER TABLE public.saga_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saga_transitions_select" ON public.saga_transitions
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "saga_transitions_insert" ON public.saga_transitions
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));

-- No UPDATE or DELETE policies — rows are immutable by design.

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saga_transitions_case_id
  ON public.saga_transitions (value_case_id, organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saga_transitions_correlation
  ON public.saga_transitions (correlation_id);

CREATE INDEX IF NOT EXISTS idx_saga_transitions_states
  ON public.saga_transitions (from_state, to_state);
