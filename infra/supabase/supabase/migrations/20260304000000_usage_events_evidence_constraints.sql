-- Enforce billing evidence chain on raw usage events.
-- Required evidence for every usage event:
--   - request_id (trace)
--   - agent_uuid (workload identity)
--   - workload_identity (SPIFFE/SPIRE-issued principal)
--   - deterministic idempotency_key

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usage_events' AND column_name = 'agent_uuid'
  ) THEN
    ALTER TABLE public.usage_events ADD COLUMN agent_uuid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usage_events' AND column_name = 'workload_identity'
  ) THEN
    ALTER TABLE public.usage_events ADD COLUMN workload_identity text;
  END IF;
END $$;

-- These checks are added NOT VALID to avoid blocking on legacy rows while
-- enforcing requirements for all new writes.
ALTER TABLE public.usage_events
  DROP CONSTRAINT IF EXISTS usage_events_request_id_required,
  DROP CONSTRAINT IF EXISTS usage_events_agent_uuid_required,
  DROP CONSTRAINT IF EXISTS usage_events_workload_identity_required,
  DROP CONSTRAINT IF EXISTS usage_events_idempotency_key_required,
  DROP CONSTRAINT IF EXISTS usage_events_idempotency_key_sha256_check;

ALTER TABLE public.usage_events
  ADD CONSTRAINT usage_events_request_id_required
    CHECK (request_id IS NOT NULL AND btrim(request_id) <> '') NOT VALID,
  ADD CONSTRAINT usage_events_agent_uuid_required
    CHECK (agent_uuid IS NOT NULL AND btrim(agent_uuid) <> '') NOT VALID,
  ADD CONSTRAINT usage_events_workload_identity_required
    CHECK (workload_identity IS NOT NULL AND btrim(workload_identity) <> '') NOT VALID,
  ADD CONSTRAINT usage_events_idempotency_key_required
    CHECK (idempotency_key IS NOT NULL AND btrim(idempotency_key) <> '') NOT VALID,
  ADD CONSTRAINT usage_events_idempotency_key_sha256_check
    CHECK (idempotency_key ~ '^[a-f0-9]{64}$') NOT VALID;

-- Deterministic key dedupe (tenant + key) for new writes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_tenant_idempotency_evidence
  ON public.usage_events (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.usage_events.request_id IS
  'Trace/request identifier required for billing evidence and replay analysis.';
COMMENT ON COLUMN public.usage_events.agent_uuid IS
  'Logical workload identity emitting this event (agent UUID/service UUID).';
COMMENT ON COLUMN public.usage_events.workload_identity IS
  'SPIFFE/SPIRE identity presented by workload (e.g., spiffe://valueos/ns/valynt/sa/backend).';
COMMENT ON COLUMN public.usage_events.idempotency_key IS
  'Deterministic SHA-256 idempotency key derived from tenant_id + request_id + agent_uuid + metric.';
