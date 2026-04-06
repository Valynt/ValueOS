-- Restore missing RLS contract objects that are still referenced by runtime
-- code and security verification tests.

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 1. agent_sessions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id              text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         uuid,
  session_token   text        NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  agent_id        text,
  context         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status          text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('pending', 'active', 'completed', 'failed', 'cancelled')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  is_active       boolean     NOT NULL DEFAULT true,
  is_completed    boolean     NOT NULL DEFAULT false,
  metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  tenant_id       text        NOT NULL,
  organization_id uuid
);

ALTER TABLE public.agent_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS session_token text,
  ADD COLUMN IF NOT EXISTS agent_id text,
  ADD COLUMN IF NOT EXISTS context jsonb,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean,
  ADD COLUMN IF NOT EXISTS is_completed boolean,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS organization_id uuid;

ALTER TABLE public.agent_sessions
  ALTER COLUMN session_token SET DEFAULT encode(gen_random_bytes(16), 'hex'),
  ALTER COLUMN context SET DEFAULT '{}'::jsonb,
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN started_at SET DEFAULT now(),
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_completed SET DEFAULT false,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

UPDATE public.agent_sessions
SET
  session_token = COALESCE(NULLIF(session_token, ''), encode(gen_random_bytes(16), 'hex')),
  context = COALESCE(context, '{}'::jsonb),
  status = COALESCE(status, 'active'),
  started_at = COALESCE(started_at, now()),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now()),
  is_active = COALESCE(is_active, true),
  is_completed = COALESCE(is_completed, false),
  metadata = COALESCE(metadata, '{}'::jsonb),
  tenant_id = COALESCE(tenant_id, organization_id::text)
WHERE
  session_token IS NULL
  OR context IS NULL
  OR status IS NULL
  OR started_at IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL
  OR is_active IS NULL
  OR is_completed IS NULL
  OR metadata IS NULL
  OR tenant_id IS NULL;

ALTER TABLE public.agent_sessions
  ALTER COLUMN session_token SET NOT NULL,
  ALTER COLUMN context SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN started_at SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN is_completed SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.agent_sessions'::regclass
      AND conname = 'agent_sessions_status_check'
  ) THEN
    ALTER TABLE public.agent_sessions
      ADD CONSTRAINT agent_sessions_status_check
      CHECK (status IN ('pending', 'active', 'completed', 'failed', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_sessions_tenant_id
  ON public.agent_sessions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_organization_id
  ON public.agent_sessions (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id
  ON public.agent_sessions (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prepare_agent_session_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  old_tenant_key text;
  new_tenant_key text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_tenant_key := COALESCE(OLD.organization_id::text, OLD.tenant_id);
    new_tenant_key := COALESCE(NEW.organization_id::text, NEW.tenant_id);

    IF old_tenant_key IS DISTINCT FROM new_tenant_key THEN
      RAISE EXCEPTION 'Cannot modify tenant_id';
    END IF;
  END IF;

  IF NEW.organization_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
    BEGIN
      NEW.organization_id := NEW.tenant_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      NEW.organization_id := NULL;
    END;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_sessions_prepare_write ON public.agent_sessions;
CREATE TRIGGER agent_sessions_prepare_write
BEFORE INSERT OR UPDATE ON public.agent_sessions
FOR EACH ROW
EXECUTE FUNCTION public.prepare_agent_session_write();

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_sessions_tenant_select ON public.agent_sessions;
DROP POLICY IF EXISTS agent_sessions_tenant_insert ON public.agent_sessions;
DROP POLICY IF EXISTS agent_sessions_tenant_update ON public.agent_sessions;
DROP POLICY IF EXISTS agent_sessions_tenant_delete ON public.agent_sessions;
DROP POLICY IF EXISTS agent_sessions_service_role ON public.agent_sessions;

CREATE POLICY agent_sessions_tenant_select ON public.agent_sessions
  FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(COALESCE(organization_id::text, tenant_id)));

CREATE POLICY agent_sessions_tenant_insert ON public.agent_sessions
  FOR INSERT TO authenticated
  WITH CHECK (security.user_has_tenant_access(COALESCE(organization_id::text, tenant_id)));

CREATE POLICY agent_sessions_tenant_update ON public.agent_sessions
  FOR UPDATE TO authenticated
  USING (security.user_has_tenant_access(COALESCE(organization_id::text, tenant_id)))
  WITH CHECK (security.user_has_tenant_access(COALESCE(organization_id::text, tenant_id)));

CREATE POLICY agent_sessions_tenant_delete ON public.agent_sessions
  FOR DELETE TO authenticated
  USING (security.user_has_tenant_access(COALESCE(organization_id::text, tenant_id)));

CREATE POLICY agent_sessions_service_role ON public.agent_sessions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_sessions TO authenticated;
GRANT ALL ON public.agent_sessions TO service_role;

-- ---------------------------------------------------------------------------
-- 2. dead_letter_events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dead_letter_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL,
  event_type    text        NOT NULL,
  payload       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  retry_count   integer     NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_events_tenant_created
  ON public.dead_letter_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dead_letter_events_event_type
  ON public.dead_letter_events (event_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_dead_letter_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dead_letter_events_set_updated_at ON public.dead_letter_events;
CREATE TRIGGER dead_letter_events_set_updated_at
BEFORE UPDATE ON public.dead_letter_events
FOR EACH ROW
EXECUTE FUNCTION public.update_dead_letter_events_updated_at();

ALTER TABLE public.dead_letter_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dead_letter_events_service_role ON public.dead_letter_events;
CREATE POLICY dead_letter_events_service_role ON public.dead_letter_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.dead_letter_events FROM anon, authenticated;
GRANT ALL ON public.dead_letter_events TO service_role;

-- ---------------------------------------------------------------------------
-- 3. verify_rls_tenant_isolation helper RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_rls_tenant_isolation()
RETURNS TABLE(
  table_name text,
  rls_enabled boolean,
  policy_count integer,
  has_not_null_constraint boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::text,
    t.rowsecurity,
    COUNT(p.policyname)::integer,
    EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = t.tablename
        AND c.column_name IN ('tenant_id', 'organization_id')
        AND c.is_nullable = 'NO'
    )
  FROM pg_tables t
  LEFT JOIN pg_policies p
    ON p.schemaname = 'public'
   AND p.tablename = t.tablename
  WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'agent_sessions',
      'agent_predictions',
      'workflow_executions',
      'canvas_data',
      'value_trees'
    )
  GROUP BY t.tablename, t.rowsecurity;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_rls_tenant_isolation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_rls_tenant_isolation() TO service_role;