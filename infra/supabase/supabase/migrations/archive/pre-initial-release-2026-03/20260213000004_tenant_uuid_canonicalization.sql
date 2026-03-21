-- Canonicalize tenant identifiers to UUID across tenant-scoped tables.
-- Strategy:
-- 1) Introduce UUID canonical key on tenants via id_uuid (legacy text id retained temporarily).
-- 2) Add/maintain compatibility wrappers for TEXT helper signatures.
-- 3) Convert tenant-scoped tenant_id columns from text -> uuid with deterministic backfill.
-- 4) Ensure every tenant-scoped table has FK to public.tenants(id_uuid).

CREATE SCHEMA IF NOT EXISTS security;

CREATE OR REPLACE FUNCTION security.try_parse_uuid(p_value text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN NULLIF(trim(p_value), '')::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

-- Keep legacy tenant id and add UUID canonical key.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS legacy_id text,
  ADD COLUMN IF NOT EXISTS id_uuid uuid;

UPDATE public.tenants
SET legacy_id = id
WHERE legacy_id IS NULL;

UPDATE public.tenants
SET id_uuid = COALESCE(security.try_parse_uuid(legacy_id), gen_random_uuid())
WHERE id_uuid IS NULL;

ALTER TABLE public.tenants
  ALTER COLUMN id_uuid SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tenants'::regclass
      AND conname = 'tenants_id_uuid_key'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_id_uuid_key UNIQUE (id_uuid);
  END IF;
END $$;

-- UUID-native helpers.
CREATE OR REPLACE FUNCTION security.current_tenant_id_uuid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT security.try_parse_uuid(
    COALESCE(
      NULLIF(current_setting('app.tenant_id', true), ''),
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id'),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')
    )
  );
$$;

CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND target_tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid()::text
        AND ut.tenant_id = target_tenant_id
        AND ut.status = 'active'
    );
$$;

-- Temporary compatibility wrapper.
CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT security.user_has_tenant_access(security.try_parse_uuid(target_tenant_id));
$$;

CREATE OR REPLACE FUNCTION security.is_current_user_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT security.user_has_tenant_access(p_tenant_id);
$$;

-- Temporary compatibility wrapper.
CREATE OR REPLACE FUNCTION security.is_current_user_tenant_member(p_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT security.is_current_user_tenant_member(security.try_parse_uuid(p_tenant_id));
$$;

CREATE OR REPLACE FUNCTION app.is_active_member(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = _tenant_id AND m.user_id = _user_id AND m.status = 'active'
  );
$$;

-- Temporary compatibility wrapper.
CREATE OR REPLACE FUNCTION app.is_active_member(_tenant_id text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app.is_active_member(security.try_parse_uuid(_tenant_id), _user_id);
$$;

-- Convert remaining text tenant_id columns to UUID using tenants legacy-id mapping.
DO $$
DECLARE
  tbl text;
  is_not_null boolean;
  fk RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'agent_memory',
    'agent_metrics',
    'agent_predictions',
    'agent_retraining_queue',
    'billing_customers',
    'invoices',
    'subscriptions',
    'tenant_integrations',
    'usage_aggregates',
    'usage_alerts',
    'usage_quotas',
    'user_roles',
    'user_tenants',
    'value_cases',
    'memberships',
    'value_commitments',
    'invitations',
    'memory_benchmark_versions',
    'memory_model_run_evidence'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = tbl
        AND c.column_name = 'tenant_id'
        AND c.data_type IN ('text', 'character varying', 'character')
    ) THEN
      FOR fk IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = format('public.%I', tbl)::regclass
          AND contype = 'f'
          AND conkey = ARRAY[
            (SELECT attnum FROM pg_attribute
             WHERE attrelid = format('public.%I', tbl)::regclass
               AND attname = 'tenant_id'
               AND NOT attisdropped)
          ]
      LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I;', tbl, fk.conname);
      END LOOP;

      EXECUTE format($stmt$
        UPDATE public.%I t
        SET tenant_id = tenant.id_uuid::text
        FROM public.tenants tenant
        WHERE t.tenant_id = tenant.legacy_id
      $stmt$, tbl);

      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id TYPE uuid USING security.try_parse_uuid(tenant_id);', tbl);

      SELECT (is_nullable = 'NO')
      INTO is_not_null
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'tenant_id';

      IF is_not_null THEN
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL;', tbl);
      END IF;

      EXECUTE format(
        'DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = %L) THEN
            ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES public.tenants(id_uuid) ON DELETE CASCADE;
          END IF;
        END $$;',
        tbl || '_tenant_id_fkey',
        tbl,
        tbl || '_tenant_id_fkey'
      );
    END IF;
  END LOOP;
END $$;

-- Route tenant-isolation policies through UUID-native helper.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND c.data_type = 'uuid'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> 'user_tenants'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON public.%I;', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON public.%I;', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON public.%I;', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON public.%I;', r.table_name);

    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON public.%I AS RESTRICTIVE FOR SELECT USING (security.user_has_tenant_access(tenant_id));',
      r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id));',
      r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON public.%I AS RESTRICTIVE FOR UPDATE USING (security.user_has_tenant_access(tenant_id)) WITH CHECK (security.user_has_tenant_access(tenant_id));',
      r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON public.%I AS RESTRICTIVE FOR DELETE USING (security.user_has_tenant_access(tenant_id));',
      r.table_name
    );
  END LOOP;
END $$;
