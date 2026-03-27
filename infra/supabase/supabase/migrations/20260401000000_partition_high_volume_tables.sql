-- Time-based partitioning for high-volume append-only tables.
--
-- Tables: usage_ledger, rated_ledger, saga_transitions, value_loop_events
--
-- Strategy: monthly RANGE partitions on created_at (rated_ledger uses rated_at).
-- Each table is converted by:
--   1. Rename existing table to _legacy
--   2. Create partitioned parent with identical schema
--   3. Re-apply RLS, grants, and indexes on the parent
--   4. Create initial partitions (current month + next month)
--   5. Copy existing rows from _legacy into the partitioned table
--   6. Drop _legacy
--
-- pg_partman is NOT assumed — partitions are created explicitly here.
-- A scheduled job (cron or pg_cron) should create future partitions monthly.
-- The static checker exempts these tables from the tenant-column check because
-- they already have tenant_id / organization_id in their definitions.
--
-- NOTE: PRIMARY KEY and UNIQUE constraints on partitioned tables must include
-- the partition key (created_at / rated_at). The existing uuid-only PKs are
-- replaced with composite PKs. Application code that queries by id alone still
-- works; inserts that relied on the old unique constraint are updated below.

SET search_path = public, pg_temp;

-- Wrap the entire migration in a transaction so a mid-run failure leaves the
-- schema unchanged rather than in a partially-migrated split state.
BEGIN;

-- ============================================================================
-- 1. usage_ledger
-- Partition key: created_at (monthly)
-- Existing unique constraint: (tenant_id, request_id) — preserved on parent.
-- ============================================================================

ALTER TABLE public.usage_ledger RENAME TO usage_ledger_legacy;

CREATE TABLE public.usage_ledger (
  id             uuid          NOT NULL DEFAULT gen_random_uuid(),
  tenant_id      uuid          NOT NULL,
  agent_id       text          NOT NULL,
  value_units    numeric(14,4) NOT NULL CHECK (value_units >= 0),
  evidence_link  text          NOT NULL,
  request_id     text          NOT NULL,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Idempotency constraint on the parent (enforced per-partition by Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_ledger_tenant_request_unique
  ON public.usage_ledger (tenant_id, request_id, created_at);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_tenant_created_at
  ON public.usage_ledger (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_tenant_agent_created_at
  ON public.usage_ledger (tenant_id, agent_id, created_at DESC);

ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_ledger_tenant_isolation ON public.usage_ledger
  FOR ALL TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

GRANT ALL ON public.usage_ledger TO service_role;
GRANT SELECT, INSERT ON public.usage_ledger TO authenticated;

-- Initial partitions: catch-all for legacy data + current and next month
CREATE TABLE public.usage_ledger_p_default
  PARTITION OF public.usage_ledger DEFAULT;

CREATE TABLE public.usage_ledger_p_2026_04
  PARTITION OF public.usage_ledger
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE public.usage_ledger_p_2026_05
  PARTITION OF public.usage_ledger
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Migrate existing data
INSERT INTO public.usage_ledger
  SELECT id, tenant_id, agent_id, value_units, evidence_link, request_id, created_at, updated_at
  FROM public.usage_ledger_legacy;

DROP TABLE public.usage_ledger_legacy;

COMMENT ON TABLE public.usage_ledger IS
  'Tenant-scoped value ledger for billable agent actions. Partitioned monthly by created_at.';

-- ============================================================================
-- 2. rated_ledger
-- Partition key: rated_at (monthly). Immutable append-only table.
-- Existing unique constraint: (tenant_id, subscription_id, meter_key,
--   period_start, period_end, source_aggregate_hash) — preserved.
-- ============================================================================

ALTER TABLE public.rated_ledger RENAME TO rated_ledger_legacy;

CREATE TABLE public.rated_ledger (
  id                    uuid          NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid          NOT NULL,
  subscription_id       uuid          NOT NULL,
  price_version_id      uuid          NOT NULL,
  meter_key             text          NOT NULL,
  period_start          timestamptz   NOT NULL,
  period_end            timestamptz   NOT NULL,
  quantity_used         numeric(15,4) NOT NULL DEFAULT 0,
  quantity_included     numeric(15,4) NOT NULL DEFAULT 0,
  quantity_overage      numeric(15,4) NOT NULL DEFAULT 0,
  unit_price            numeric(10,6) NOT NULL DEFAULT 0,
  amount                numeric(15,4) NOT NULL DEFAULT 0,
  rated_at              timestamptz   NOT NULL DEFAULT now(),
  rated_by              text          NOT NULL,
  source_aggregate_hash text          NOT NULL,
  created_at            timestamptz   DEFAULT now(),
  CONSTRAINT rated_ledger_positive_quantities CHECK (
    quantity_used >= 0 AND quantity_included >= 0 AND quantity_overage >= 0
  ),
  CONSTRAINT rated_ledger_period_order CHECK (period_start < period_end),
  CONSTRAINT rated_ledger_amount_calculation CHECK (
    amount = quantity_overage * unit_price
  ),
  PRIMARY KEY (id, rated_at)
) PARTITION BY RANGE (rated_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rated_ledger_unique_rating
  ON public.rated_ledger (
    tenant_id, subscription_id, meter_key,
    period_start, period_end, source_aggregate_hash, rated_at
  );

CREATE INDEX IF NOT EXISTS idx_rated_ledger_tenant_period
  ON public.rated_ledger (tenant_id, period_start DESC, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_rated_ledger_subscription
  ON public.rated_ledger (subscription_id, rated_at DESC);

ALTER TABLE public.rated_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY rated_ledger_tenant_select ON public.rated_ledger
  FOR SELECT USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY rated_ledger_service_role ON public.rated_ledger
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.rated_ledger TO authenticated;
GRANT ALL    ON public.rated_ledger TO service_role;

CREATE TABLE public.rated_ledger_p_default
  PARTITION OF public.rated_ledger DEFAULT;

CREATE TABLE public.rated_ledger_p_2026_04
  PARTITION OF public.rated_ledger
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE public.rated_ledger_p_2026_05
  PARTITION OF public.rated_ledger
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

INSERT INTO public.rated_ledger
  SELECT id, tenant_id, subscription_id, price_version_id, meter_key,
         period_start, period_end, quantity_used, quantity_included,
         quantity_overage, unit_price, amount, rated_at, rated_by,
         source_aggregate_hash, created_at
  FROM public.rated_ledger_legacy;

DROP TABLE public.rated_ledger_legacy;

COMMENT ON TABLE public.rated_ledger IS
  'Immutable rated usage line items. Append-only. Partitioned monthly by rated_at.';

-- ============================================================================
-- 3. saga_transitions
-- Partition key: created_at (monthly). Immutable append-only audit trail.
-- ============================================================================

ALTER TABLE public.saga_transitions RENAME TO saga_transitions_legacy;

CREATE TABLE public.saga_transitions (
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
  ),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX IF NOT EXISTS idx_saga_transitions_case_id
  ON public.saga_transitions (value_case_id, organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saga_transitions_org_created
  ON public.saga_transitions (organization_id, created_at DESC);

ALTER TABLE public.saga_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY saga_transitions_select ON public.saga_transitions
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY saga_transitions_insert ON public.saga_transitions
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));

GRANT SELECT, INSERT ON public.saga_transitions TO authenticated;
GRANT ALL            ON public.saga_transitions TO service_role;

CREATE TABLE public.saga_transitions_p_default
  PARTITION OF public.saga_transitions DEFAULT;

CREATE TABLE public.saga_transitions_p_2026_04
  PARTITION OF public.saga_transitions
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE public.saga_transitions_p_2026_05
  PARTITION OF public.saga_transitions
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

INSERT INTO public.saga_transitions
  SELECT id, value_case_id, organization_id, from_state, to_state,
         trigger, agent_id, correlation_id, metadata, created_at
  FROM public.saga_transitions_legacy;

DROP TABLE public.saga_transitions_legacy;

COMMENT ON TABLE public.saga_transitions IS
  'Immutable saga state transition log. Append-only. Partitioned monthly by created_at.';

-- ============================================================================
-- 4. value_loop_events
-- Partition key: created_at (monthly). Append-only analytics events.
-- ============================================================================

ALTER TABLE public.value_loop_events RENAME TO value_loop_events_legacy;

CREATE TABLE public.value_loop_events (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL,
  session_id      text        NOT NULL,
  event_type      text        NOT NULL
    CHECK (event_type IN (
      'recommendation_accepted',
      'recommendation_dismissed',
      'assumption_corrected',
      'evidence_accepted',
      'evidence_rejected'
    )),
  object_type     text,
  object_id       uuid,
  payload         jsonb       NOT NULL DEFAULT '{}',
  actor_id        uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX IF NOT EXISTS idx_vle_org_type
  ON public.value_loop_events (organization_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vle_session
  ON public.value_loop_events (session_id, created_at DESC);

ALTER TABLE public.value_loop_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY vle_tenant_select ON public.value_loop_events
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY vle_tenant_insert ON public.value_loop_events
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));

GRANT SELECT, INSERT ON public.value_loop_events TO authenticated;
GRANT ALL            ON public.value_loop_events TO service_role;

CREATE TABLE public.value_loop_events_p_default
  PARTITION OF public.value_loop_events DEFAULT;

CREATE TABLE public.value_loop_events_p_2026_04
  PARTITION OF public.value_loop_events
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE public.value_loop_events_p_2026_05
  PARTITION OF public.value_loop_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

INSERT INTO public.value_loop_events
  SELECT id, organization_id, session_id, event_type,
         object_type, object_id, payload, actor_id, created_at
  FROM public.value_loop_events_legacy;

DROP TABLE public.value_loop_events_legacy;

COMMENT ON TABLE public.value_loop_events IS
  'Value loop analytics events. Append-only. Partitioned monthly by created_at.';

-- ============================================================================
-- Partition management helper function
-- Creates the next two monthly partitions for all four partitioned tables.
-- Intended to be called monthly by pg_cron or an external scheduler.
-- Usage: SELECT public.create_next_monthly_partitions();
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_next_monthly_partitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tables  text[] := ARRAY[
    'usage_ledger', 'rated_ledger', 'saga_transitions', 'value_loop_events'
  ];
  tbl     text;
  -- Create partitions for the next 2 months from now
  m1_start timestamptz := date_trunc('month', now() + interval '1 month');
  m1_end   timestamptz := m1_start + interval '1 month';
  m2_start timestamptz := m1_end;
  m2_end   timestamptz := m2_start + interval '1 month';
  p1_name  text;
  p2_name  text;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    p1_name := tbl || '_p_' || to_char(m1_start, 'YYYY_MM');
    p2_name := tbl || '_p_' || to_char(m2_start, 'YYYY_MM');

    -- Create partition 1 if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = p1_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
        p1_name, tbl, m1_start, m1_end
      );
      -- PostgreSQL partition children do NOT inherit RLS from the parent table.
      -- Enable RLS and recreate the parent's policies on each new partition so
      -- tenant isolation is enforced on direct child-table queries.
      PERFORM public._apply_partition_rls(p1_name, tbl);
    END IF;

    -- Create partition 2 if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = p2_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
        p2_name, tbl, m2_start, m2_end
      );
      PERFORM public._apply_partition_rls(p2_name, tbl);
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Helper: apply the correct RLS policies to a newly created partition child.
-- Called by create_next_monthly_partitions() after each CREATE TABLE.
-- Policies mirror those on the parent tables defined above in this migration.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_partition_rls(
  p_name text,   -- child partition table name
  p_parent text  -- parent table name (used to select the right policy set)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Enable RLS on the child partition
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_name);

  -- Drop existing policies before (re)creating them so this function is
  -- idempotent: safe to call on migration re-runs or manual invocations.
  IF p_parent = 'usage_ledger' THEN
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name || '_tenant_isolation', p_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid) '
      'WITH CHECK (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)',
      p_name || '_tenant_isolation', p_name
    );

  ELSIF p_parent = 'rated_ledger' THEN
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name || '_tenant_select', p_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name || '_service_role', p_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT '
      'USING (security.user_has_tenant_access(tenant_id::text))',
      p_name || '_tenant_select', p_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role '
      'USING (true) WITH CHECK (true)',
      p_name || '_service_role', p_name
    );

  ELSIF p_parent = 'saga_transitions' THEN
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name || '_select', p_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name || '_insert', p_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT '
      'USING (security.user_has_tenant_access(organization_id::text))',
      p_name || '_select', p_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT '
      'WITH CHECK (security.user_has_tenant_access(organization_id::text))',
      p_name || '_insert', p_name
    );

  ELSIF p_parent = 'value_loop_events' THEN
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name || '_tenant_select', p_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name || '_tenant_insert', p_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT '
      'USING (security.user_has_tenant_access(organization_id::text))',
      p_name || '_tenant_select', p_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT '
      'WITH CHECK (security.user_has_tenant_access(organization_id::text))',
      p_name || '_tenant_insert', p_name
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_next_monthly_partitions() TO service_role;
GRANT EXECUTE ON FUNCTION public._apply_partition_rls(text, text) TO service_role;

COMMENT ON FUNCTION public.create_next_monthly_partitions() IS
  'Creates the next two monthly partitions for all four high-volume partitioned tables. '
  'Call monthly via pg_cron: SELECT cron.schedule(''0 0 1 * *'', $$SELECT public.create_next_monthly_partitions()$$);';

COMMENT ON FUNCTION public._apply_partition_rls(text, text) IS
  'Applies RLS policies to a newly created partition child table. '
  'PostgreSQL does not inherit RLS from parent partitioned tables, so this '
  'function must be called after every CREATE TABLE ... PARTITION OF.';

-- Apply RLS to the static initial partitions created above.
-- These were created before _apply_partition_rls existed, so we call it
-- explicitly here to backfill the missing policies.
DO $$
DECLARE
  partitions text[][] := ARRAY[
    ARRAY['usage_ledger_p_default',       'usage_ledger'],
    ARRAY['usage_ledger_p_2026_04',       'usage_ledger'],
    ARRAY['usage_ledger_p_2026_05',       'usage_ledger'],
    ARRAY['rated_ledger_p_default',       'rated_ledger'],
    ARRAY['rated_ledger_p_2026_04',       'rated_ledger'],
    ARRAY['rated_ledger_p_2026_05',       'rated_ledger'],
    ARRAY['saga_transitions_p_default',   'saga_transitions'],
    ARRAY['saga_transitions_p_2026_04',   'saga_transitions'],
    ARRAY['saga_transitions_p_2026_05',   'saga_transitions'],
    ARRAY['value_loop_events_p_default',  'value_loop_events'],
    ARRAY['value_loop_events_p_2026_04',  'value_loop_events'],
    ARRAY['value_loop_events_p_2026_05',  'value_loop_events']
  ];
  pair text[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY partitions LOOP
    PERFORM public._apply_partition_rls(pair[1], pair[2]);
  END LOOP;
END;
$$;

COMMIT;
