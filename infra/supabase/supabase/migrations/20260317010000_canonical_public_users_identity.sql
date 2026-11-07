-- Canonical app-owned identity mirror. Supabase auth.users.id (UUID) is the
-- authentication authority. public.user_tenants.user_id remains TEXT deliberately,
-- and is compared to auth.uid()::text for membership enforcement.
-- The mirror is NOT an authentication or membership authority.
-- No synthetic users, default passwords, or implicit tenant assignments.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

BEGIN;

-- Composite FK guarantees the optional "home" organization and TEXT tenant
-- refer to the same organization. It is not used to authorize membership.
DO $identity_index$
BEGIN
  IF to_regclass('public.organizations_id_tenant_id_unique') IS NULL THEN
    CREATE UNIQUE INDEX organizations_id_tenant_id_unique
      ON public.organizations (id, tenant_id);
    COMMENT ON INDEX public.organizations_id_tenant_id_unique IS 'valueos-canonical-users:20260317010000';
  END IF;
END $identity_index$;

DO $identity$
DECLARE
  col record;
  expected_type oid;
  actual_type oid;
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Supabase auth.users missing: refuse to fabricate production authentication'
      USING ERRCODE = '42P01';
  END IF;

  IF to_regclass('public.users') IS NULL THEN
    CREATE TABLE public.users (
      id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
      tenant_id       text NOT NULL REFERENCES public.tenants(id),
      organization_id uuid NOT NULL,
      email           text,
      name            text,
      full_name       text,
      display_name    text,
      avatar_url      text,
      metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
      last_signed_in  timestamptz,
      maturity_level  integer,
      vos_role        text,
      role            text,
      tier            text,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT users_organization_tenant_fk
        FOREIGN KEY (organization_id, tenant_id)
        REFERENCES public.organizations (id, tenant_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
    );
    COMMENT ON TABLE public.users IS 'valueos-canonical-users:20260317010000; auth UUID identity, one home tenant; memberships live in user_tenants';
  ELSE
    -- Fail closed on incompatible legacy tables. ALTER TYPE would require
    -- auditing every FK, profile and tenant record and an explicit data plan.
    FOR col IN
      SELECT * FROM (VALUES
        ('id', 'uuid'),
        ('tenant_id', 'text'),
        ('organization_id', 'uuid'),
        ('email', 'text'),
        ('name', 'text'),
        ('full_name', 'text'),
        ('display_name', 'text'),
        ('avatar_url', 'text'),
        ('metadata', 'jsonb'),
        ('last_signed_in', 'timestamp with time zone'),
        ('maturity_level', 'integer'),
        ('vos_role', 'text'),
        ('role', 'text'),
        ('tier', 'text'),
        ('created_at', 'timestamp with time zone'),
        ('updated_at', 'timestamp with time zone')
      ) AS required(column_name, type_name)
    LOOP
      SELECT a.atttypid INTO actual_type
        FROM pg_attribute a
        WHERE a.attrelid = 'public.users'::regclass
          AND a.attname = col.column_name
          AND NOT a.attisdropped;
      expected_type := to_regtype(col.type_name)::oid;
      IF actual_type IS DISTINCT FROM expected_type THEN
        RAISE EXCEPTION 'public.users.% must be % (observed %). Manual data-safe identity migration required',
          col.column_name, col.type_name, COALESCE(actual_type::regtype::text, 'missing')
          USING ERRCODE = '42804';
      END IF;
    END LOOP;
    IF EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = 'public.users'::regclass
        AND a.attname IN ('id', 'tenant_id', 'organization_id')
        AND NOT a.attisdropped AND NOT a.attnotnull
    ) THEN
      RAISE EXCEPTION 'Existing public.users contains nullable canonical identity/tenant fields'
        USING ERRCODE = '23502';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.users'::regclass
        AND c.confrelid = 'auth.users'::regclass
        AND c.contype = 'f'
        AND c.conkey = ARRAY[
          (SELECT attnum FROM pg_attribute
           WHERE attrelid = 'public.users'::regclass AND attname = 'id')
        ]::smallint[]
    ) THEN
      RAISE EXCEPTION 'Existing public.users lacks FK from id to auth.users.id: reconcile and validate rows before release'
        USING ERRCODE = '23503';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.users'::regclass
        AND c.conname = 'users_organization_tenant_fk'
        AND c.contype = 'f'
        AND c.convalidated
    ) THEN
      RAISE EXCEPTION 'Existing public.users lacks validated organization/tenant FK: reconcile before release'
        USING ERRCODE = '23503';
    END IF;
  END IF;
END $identity$;

CREATE INDEX IF NOT EXISTS idx_users_org_id
  ON public.users (organization_id, id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id
  ON public.users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_org_last_signed_in
  ON public.users (organization_id, last_signed_in DESC);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM PUBLIC, anon, authenticated;

-- Members can see/edit only their own profile. Tenant and authorization fields
-- are service-managed and cannot be written by an authenticated subject.
DROP POLICY IF EXISTS users_own_row_select ON public.users;
DROP POLICY IF EXISTS users_own_row_update ON public.users;
DROP POLICY IF EXISTS users_service_role ON public.users;

CREATE POLICY users_own_row_select ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY users_own_row_update ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY users_service_role ON public.users
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (name, display_name, avatar_url) ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
REVOKE ALL ON public.users FROM anon;

COMMIT;
