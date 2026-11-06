-- Repair #2665 without changing legacy UUID tenant IDs or guessing ownership.
-- rls-classification: tenant_scoped
-- The early copy precedes the duplicate CREATE TABLE's organization_id indexes.
-- The November copy applies the same contract to already-migrated installations.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

LOCK TABLE public.organizations, public.value_cases,
  public.assumptions, public.scenarios IN SHARE ROW EXCLUSIVE MODE;

DO $scope$
DECLARE
  target text;
  col text;
  observed regtype;
  invalid boolean;
BEGIN
  FOREACH target IN ARRAY ARRAY['assumptions', 'scenarios'] LOOP
    -- An organization-only installation may lack tenant_id. Never ALTER TYPE.
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid', target);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid', target);
    FOREACH col IN ARRAY ARRAY['id', 'case_id', 'tenant_id', 'organization_id'] LOOP
      SELECT atttypid::regtype INTO observed FROM pg_attribute
        WHERE attrelid = format('public.%I', target)::regclass
          AND attname = col AND NOT attisdropped;
      IF observed IS DISTINCT FROM 'uuid'::regtype THEN
        RAISE EXCEPTION 'Value-modeling %.% must be UUID; manual scope reconciliation required', target, col
          USING ERRCODE = '42804';
      END IF;
    END LOOP;

    -- Only the explicit case.organization_id -> organizations.id relationship
    -- authorizes a backfill. Neither UUID shape nor tenant equality chooses an org.
    EXECUTE format($query$
      SELECT EXISTS (
        SELECT 1 FROM public.%I r
        LEFT JOIN public.value_cases c ON c.id = r.case_id
        LEFT JOIN public.organizations o ON o.id = c.organization_id
        WHERE o.id IS NULL
          OR o.tenant_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          OR (c.tenant_id IS NOT NULL AND c.tenant_id IS DISTINCT FROM o.tenant_id)
          OR (r.tenant_id IS NOT NULL AND r.tenant_id::text IS DISTINCT FROM o.tenant_id)
          OR (r.organization_id IS NOT NULL AND r.organization_id IS DISTINCT FROM o.id)
      )
    $query$, target) INTO invalid;
    IF invalid THEN
      RAISE EXCEPTION 'Value-modeling % has absent, incompatible or contradictory case/organization ownership; manual scope reconciliation required', target
        USING ERRCODE = '23514';
    END IF;
    EXECUTE format($query$
      UPDATE public.%I r SET organization_id = o.id, tenant_id = o.tenant_id::uuid
      FROM public.value_cases c JOIN public.organizations o ON o.id = c.organization_id
      WHERE r.case_id = c.id AND (r.organization_id IS NULL OR r.tenant_id IS NULL)
    $query$, target);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL, ALTER COLUMN tenant_id SET NOT NULL', target);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
  END LOOP;
END $scope$;

-- Prevent an existing case from silently moving a model to another organization.
CREATE UNIQUE INDEX IF NOT EXISTS value_cases_id_organization_scope_key
  ON public.value_cases (id, organization_id);
DO $constraints$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['assumptions', 'scenarios'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid = format('public.%I', target)::regclass
        AND conname = target || '_case_organization_scope_fk') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (case_id, organization_id) REFERENCES public.value_cases (id, organization_id) ON DELETE CASCADE',
        target, target || '_case_organization_scope_fk');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid = format('public.%I', target)::regclass
        AND conname = target || '_organization_scope_fk') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES public.organizations (id)',
        target, target || '_organization_scope_fk');
    END IF;
  END LOOP;
END $constraints$;

-- SECURITY INVOKER preserves caller privileges and RLS during lookup.
-- Both old tenant-only and newer organization-only writers use the case's
-- explicit organization mapping; conflicting supplied values are rejected.
CREATE OR REPLACE FUNCTION public.enforce_value_modeling_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE org uuid; tenant text; case_tenant text;
BEGIN
  SELECT o.id, o.tenant_id, c.tenant_id INTO org, tenant, case_tenant
    FROM public.value_cases c JOIN public.organizations o ON o.id = c.organization_id
    WHERE c.id = NEW.case_id;
  IF org IS NULL
    OR tenant !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR (case_tenant IS NOT NULL AND case_tenant IS DISTINCT FROM tenant)
    OR (NEW.organization_id IS NOT NULL AND NEW.organization_id IS DISTINCT FROM org)
    OR (NEW.tenant_id IS NOT NULL AND NEW.tenant_id::text IS DISTINCT FROM tenant) THEN
    RAISE EXCEPTION 'Value-modeling scope is absent, incompatible or contradictory; manual scope reconciliation required'
      USING ERRCODE = '23514';
  END IF;
  NEW.organization_id := org;
  NEW.tenant_id := tenant::uuid;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.enforce_value_modeling_scope() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_value_modeling_scope() TO authenticated, service_role;

DO $policies$
DECLARE target text; predicate text;
BEGIN
  FOREACH target IN ARRAY ARRAY['assumptions', 'scenarios'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS value_modeling_scope ON public.%I', target);
    EXECUTE format('CREATE TRIGGER value_modeling_scope BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_value_modeling_scope()', target);
    -- Restrictive policy is ANDed with ALL historical permissive policies,
    -- including the later organization_id::text policy. Organization UUIDs
    -- are NOT tenant membership identifiers.
    predicate := format('EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = %I.organization_id AND o.tenant_id = %I.tenant_id::text AND security.user_has_tenant_access(o.tenant_id))', target, target);
    EXECUTE format('DROP POLICY IF EXISTS value_modeling_scope_guard ON public.%I', target);
    EXECUTE format('CREATE POLICY value_modeling_scope_guard ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (%s) WITH CHECK (%s)', target, predicate, predicate);
    EXECUTE format('DROP POLICY IF EXISTS value_modeling_scope_member ON public.%I', target);
    EXECUTE format('CREATE POLICY value_modeling_scope_member ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)', target, predicate, predicate);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', target);
  END LOOP;
END $policies$;
COMMIT;
