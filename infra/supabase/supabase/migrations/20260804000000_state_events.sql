-- ============================================================================
-- state_events — event-sourcing store for optimistic-lock state changes
--
-- Used by EventSourcingManager (apps/ValyntApp/src/state/EventSourcing.ts)
-- to persist aggregate state transitions with version-based conflict detection.
--
-- Tenant isolation: every row carries tenant_id (NOT NULL).
-- RLS: authenticated users read only their own tenant's events;
--      service_role has full access for server-side replay and compaction.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.state_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL,
  aggregate_id     text        NOT NULL,
  aggregate_type   text        NOT NULL,
  event_type       text        NOT NULL,
  event_data       jsonb       NOT NULL DEFAULT '{}',
  version          integer     NOT NULL,
  timestamp        timestamptz NOT NULL DEFAULT now(),
  causation_id     text,
  correlation_id   text,
  metadata         jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- Optimistic-lock uniqueness: one version per aggregate per tenant
  CONSTRAINT state_events_aggregate_version_unique
    UNIQUE (tenant_id, aggregate_id, version)
);

-- Primary read path: replay all events for an aggregate in order
CREATE INDEX IF NOT EXISTS idx_state_events_tenant_aggregate_version
  ON public.state_events (tenant_id, aggregate_id, version ASC);

-- Secondary path: look up a single event by id within a tenant
CREATE INDEX IF NOT EXISTS idx_state_events_tenant_id
  ON public.state_events (tenant_id, id);

-- Aggregate-type fan-out queries (e.g. "all canvas_state events for tenant")
CREATE INDEX IF NOT EXISTS idx_state_events_tenant_type
  ON public.state_events (tenant_id, aggregate_type, created_at DESC);

ALTER TABLE public.state_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS state_events_select   ON public.state_events;
DROP POLICY IF EXISTS state_events_insert   ON public.state_events;
DROP POLICY IF EXISTS state_events_service_role ON public.state_events;

-- Authenticated users may read events belonging to their tenant
CREATE POLICY state_events_select ON public.state_events
  FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(tenant_id));

-- Authenticated users may append events for their own tenant
CREATE POLICY state_events_insert ON public.state_events
  FOR INSERT TO authenticated
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- service_role has unrestricted access (replay, compaction, admin)
CREATE POLICY state_events_service_role ON public.state_events
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.state_events TO authenticated;
GRANT ALL            ON public.state_events TO service_role;

COMMIT;
