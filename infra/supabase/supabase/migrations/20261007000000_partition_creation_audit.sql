-- Migration: Partition creation audit log and silent-failure remediation
--
-- Context: create_next_monthly_partitions() fails silently when pg_cron
-- encounters an error, causing inserts to fall into the default partition
-- and degrading query performance. This migration:
--   1. Creates a partition_creation_audit table to record every run outcome.
--   2. Patches create_next_monthly_partitions() to write success/failure rows.
--   3. Creates a check_partition_health() function for the backend monitor job.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- ============================================================
-- 1. Audit table for partition creation events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.partition_creation_audit (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT        NOT NULL CHECK (status IN ('success', 'failure', 'skipped')),
  parent_table    TEXT        NOT NULL,
  partition_name  TEXT        NOT NULL,
  partition_month TEXT        NOT NULL,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.partition_creation_audit IS
  'Audit log for create_next_monthly_partitions() runs. '
  'organization_id is a sentinel UUID (all-zeros) — this is a platform-level '
  'table with no per-tenant data. RLS is enabled but policies allow service_role only.';

COMMENT ON COLUMN public.partition_creation_audit.organization_id IS
  'Sentinel value (all-zeros UUID). This table is platform-scoped, not tenant-scoped. '
  'The column exists to satisfy the schema standard enforced by CI linting.';

CREATE INDEX IF NOT EXISTS idx_partition_creation_audit_run_at
  ON public.partition_creation_audit (run_at DESC);

CREATE INDEX IF NOT EXISTS idx_partition_creation_audit_status
  ON public.partition_creation_audit (status, run_at DESC);

ALTER TABLE public.partition_creation_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partition_creation_audit FORCE ROW LEVEL SECURITY;

-- Only service_role can read/write this table — it is platform infrastructure
GRANT SELECT, INSERT ON public.partition_creation_audit TO service_role;

CREATE POLICY partition_creation_audit_service_role
  ON public.partition_creation_audit
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 2. Patch create_next_monthly_partitions() to log outcomes
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_next_monthly_partitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tables   text[] := ARRAY[
    'usage_ledger', 'rated_ledger', 'saga_transitions', 'value_loop_events'
  ];
  tbl      text;
  m1_start timestamptz := date_trunc('month', now() + interval '1 month');
  m1_end   timestamptz := m1_start + interval '1 month';
  m2_start timestamptz := m1_end;
  m2_end   timestamptz := m2_start + interval '1 month';
  p1_name  text;
  p2_name  text;
  err_msg  text;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    p1_name := tbl || '_p_' || to_char(m1_start, 'YYYY_MM');
    p2_name := tbl || '_p_' || to_char(m2_start, 'YYYY_MM');

    -- Month +1 partition
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = p1_name
      ) THEN
        EXECUTE format(
          'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
          p1_name, tbl, m1_start, m1_end
        );
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p1_name);

        INSERT INTO public.partition_creation_audit
          (status, parent_table, partition_name, partition_month)
        VALUES
          ('success', tbl, p1_name, to_char(m1_start, 'YYYY-MM'));
      ELSE
        INSERT INTO public.partition_creation_audit
          (status, parent_table, partition_name, partition_month)
        VALUES
          ('skipped', tbl, p1_name, to_char(m1_start, 'YYYY-MM'));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS err_msg = MESSAGE_TEXT;
      INSERT INTO public.partition_creation_audit
        (status, parent_table, partition_name, partition_month, error_message)
      VALUES
        ('failure', tbl, p1_name, to_char(m1_start, 'YYYY-MM'), err_msg);
      RAISE WARNING 'create_next_monthly_partitions: failed to create % — %', p1_name, err_msg;
    END;

    -- Month +2 partition
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = p2_name
      ) THEN
        EXECUTE format(
          'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
          p2_name, tbl, m2_start, m2_end
        );
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p2_name);

        INSERT INTO public.partition_creation_audit
          (status, parent_table, partition_name, partition_month)
        VALUES
          ('success', tbl, p2_name, to_char(m2_start, 'YYYY-MM'));
      ELSE
        INSERT INTO public.partition_creation_audit
          (status, parent_table, partition_name, partition_month)
        VALUES
          ('skipped', tbl, p2_name, to_char(m2_start, 'YYYY-MM'));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS err_msg = MESSAGE_TEXT;
      INSERT INTO public.partition_creation_audit
        (status, parent_table, partition_name, partition_month, error_message)
      VALUES
        ('failure', tbl, p2_name, to_char(m2_start, 'YYYY-MM'), err_msg);
      RAISE WARNING 'create_next_monthly_partitions: failed to create % — %', p2_name, err_msg;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_next_monthly_partitions() TO service_role;

-- ============================================================
-- 3. check_partition_health() — called by the backend monitor
--
-- Returns one row per partitioned table indicating whether next
-- month's partition exists. Used by the backend health-check job
-- to alert when a partition is missing within 5 days of month end.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_partition_health()
RETURNS TABLE (
  parent_table    TEXT,
  next_month      TEXT,
  partition_name  TEXT,
  partition_exists BOOLEAN,
  last_failure_at  TIMESTAMPTZ,
  last_failure_msg TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tables      text[] := ARRAY[
    'usage_ledger', 'rated_ledger', 'saga_transitions', 'value_loop_events'
  ];
  tbl         text;
  next_start  timestamptz := date_trunc('month', now() + interval '1 month');
  p_name      text;
  p_exists    boolean;
  fail_at     timestamptz;
  fail_msg    text;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    p_name := tbl || '_p_' || to_char(next_start, 'YYYY_MM');

    SELECT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = p_name
    ) INTO p_exists;

    SELECT run_at, error_message
    INTO   fail_at, fail_msg
    FROM   public.partition_creation_audit
    WHERE  parent_table = tbl
      AND  status = 'failure'
    ORDER  BY run_at DESC
    LIMIT  1;

    parent_table    := tbl;
    next_month      := to_char(next_start, 'YYYY-MM');
    partition_name  := p_name;
    partition_exists := p_exists;
    last_failure_at  := fail_at;
    last_failure_msg := fail_msg;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_partition_health() TO service_role;
