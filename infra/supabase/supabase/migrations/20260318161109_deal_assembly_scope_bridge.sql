-- Deal assembly compatibility bridge: fresh chain before 20260318161110.
-- Replayed with the later unique-version copy for already-applied histories.
-- Preserve UUID legacy opportunity IDs, JSONB fields, constraints and rows.
-- No silent UUID->TEXT or JSONB->TEXT[] conversion: runtime contract needs
-- explicit owner approval and real deployed migration histories.
-- RLS classification: all four tables are tenant_scoped.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

LOCK TABLE public.organizations, public.value_cases,
  public.deal_contexts, public.deal_context_sources,
  public.stakeholders, public.use_cases IN SHARE ROW EXCLUSIVE MODE;

DO $preflight$
DECLARE
  tbl text;
  col text;
  observed regtype;
  had_tenant boolean;
  invalid boolean;
  old_trigger text;
  legacy_trigger text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'deal_contexts', 'deal_context_sources', 'stakeholders', 'use_cases'
  ] LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_attribute WHERE
        attrelid = format('public.%I', tbl)::regclass AND
        attname = 'tenant_id' AND NOT attisdropped
    ) INTO had_tenant;

    -- Both historical migrations declare the SAME updated_at trigger names.
    -- Rename the earlier trigger rather than DROP it; writes still have an
    -- updated_at trigger if a later migration fails before recreating one.
    IF had_tenant AND tbl <> 'deal_context_sources' THEN
      old_trigger := 'update_' || tbl || '_updated_at';
      legacy_trigger := 'legacy_deal_' || tbl || '_updated_at';
      IF EXISTS (
        SELECT 1 FROM pg_trigger WHERE
          tgrelid = format('public.%I', tbl)::regclass AND
          tgname = old_trigger AND NOT tgisinternal
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE
          tgrelid = format('public.%I', tbl)::regclass AND
          tgname = legacy_trigger AND NOT tgisinternal
      ) THEN
        EXECUTE format('ALTER TRIGGER %I ON public.%I RENAME TO %I',
          old_trigger, tbl, legacy_trigger);
      END IF;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid', tbl);
    FOREACH col IN ARRAY ARRAY['id','organization_id','tenant_id'] LOOP
      SELECT atttypid::regtype INTO observed
      FROM pg_attribute WHERE
        attrelid = format('public.%I', tbl)::regclass AND
        attname = col AND NOT attisdropped;
      IF observed IS DISTINCT FROM 'uuid'::regtype THEN
        RAISE EXCEPTION 'Deal assembly %.% must remain UUID: manual review required',
          tbl, col USING ERRCODE = '42804';
      END IF;
    END LOOP;
  END LOOP;

  -- Parent ownership comes from either an explicit stored organization, or
  -- the value case's verified organization ID. Never choose an organization
  -- solely because it is the only one whose UUID resembles a tenant ID.
  SELECT EXISTS (
    SELECT 1
    FROM public.deal_contexts d
    LEFT JOIN public.value_cases c ON c.id = d.case_id
    LEFT JOIN public.organizations o
      ON o.id = COALESCE(d.organization_id, c.organization_id)
    WHERE
      o.id IS NULL
      OR o.tenant_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR (d.organization_id IS NULL AND (d.case_id IS NULL OR c.id IS NULL))
      OR (d.tenant_id IS NOT NULL AND d.tenant_id::text <> lower(o.tenant_id))
      OR (d.case_id IS NOT NULL AND
        (c.id IS NULL OR c.organization_id IS DISTINCT FROM o.id
         OR c.tenant_id IS DISTINCT FROM o.tenant_id))
  ) INTO invalid;
  IF invalid THEN
    RAISE EXCEPTION 'Deal context ownership unresolved, non-UUID, or contradictory: no inferred organization backfill'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.deal_contexts d SET organization_id = c.organization_id
  FROM public.value_cases c
  WHERE d.organization_id IS NULL AND d.case_id = c.id;
  UPDATE public.deal_contexts d SET tenant_id = o.tenant_id::uuid
  FROM public.organizations o
  WHERE d.tenant_id IS NULL AND d.organization_id = o.id;

  -- Children inherit both IDs ONLY through their exact parent row. Do not
  -- accept arbitrary matching UUIDs or cross-tenant child reparenting.
  FOREACH tbl IN ARRAY ARRAY['deal_context_sources','stakeholders','use_cases'] LOOP
    SELECT atttypid::regtype INTO observed
    FROM pg_attribute WHERE
      attrelid = format('public.%I', tbl)::regclass AND
      attname = 'deal_context_id' AND NOT attisdropped;
    IF observed IS DISTINCT FROM 'uuid'::regtype THEN
      RAISE EXCEPTION 'Deal child %.deal_context_id must be UUID', tbl
        USING ERRCODE = '42804';
    END IF;
    EXECUTE format($query$
      SELECT EXISTS (
        SELECT 1 FROM public.%I child
        LEFT JOIN public.deal_contexts parent ON parent.id = child.deal_context_id
        WHERE parent.id IS NULL OR parent.organization_id IS NULL OR parent.tenant_id IS NULL
          OR (child.organization_id IS NOT NULL AND
              child.organization_id IS DISTINCT FROM parent.organization_id)
          OR (child.tenant_id IS NOT NULL AND
              child.tenant_id IS DISTINCT FROM parent.tenant_id)
      )
    $query$, tbl) INTO invalid;
    IF invalid THEN
      RAISE EXCEPTION 'Deal child % has absent or contradictory parent scope: refusing mutation',
        tbl USING ERRCODE = '23514';
    END IF;
    EXECUTE format($query$
      UPDATE public.%I child
      SET organization_id = parent.organization_id, tenant_id = parent.tenant_id
      FROM public.deal_contexts parent
      WHERE child.deal_context_id = parent.id
        AND (child.organization_id IS NULL OR child.tenant_id IS NULL)
    $query$, tbl);
  END LOOP;

  FOREACH tbl IN ARRAY ARRAY[
    'deal_contexts','deal_context_sources','stakeholders','use_cases'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL, ALTER COLUMN tenant_id SET NOT NULL',
      tbl);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $preflight$;

-- Composite FK blocks an apparently valid child scope from referencing a
-- parent in a different tenant or organization, even for service-role writes.
CREATE UNIQUE INDEX IF NOT EXISTS deal_contexts_id_org_tenant_scope_key
  ON public.deal_contexts(id, organization_id, tenant_id);
DO $child_fk$
DECLARE tbl text; name text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['deal_context_sources','stakeholders','use_cases'] LOOP
    name := tbl || '_parent_scope_fk';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = format('public.%I', tbl)::regclass AND conname = name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (deal_context_id, organization_id, tenant_id) REFERENCES public.deal_contexts (id, organization_id, tenant_id) ON DELETE CASCADE',
        tbl, name);
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = format('public.%I', tbl)::regclass AND conname = name
        AND contype = 'f' AND confrelid = 'public.deal_contexts'::regclass
    ) THEN
      RAISE EXCEPTION 'Conflicting existing deal assembly FK for %', tbl;
    END IF;
  END LOOP;
END $child_fk$;

-- SECURITY INVOKER ensures the lookup does not bypass organizations RLS.
CREATE OR REPLACE FUNCTION public.deal_assembly_scope_matches(
  target_org uuid, target_tenant uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $fn$
  SELECT target_org IS NOT NULL AND target_tenant IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = target_org AND o.tenant_id = target_tenant::text
    );
$fn$;
REVOKE ALL ON FUNCTION public.deal_assembly_scope_matches(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deal_assembly_scope_matches(uuid,uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.deal_assembly_child_matches(
  parent_id uuid, target_org uuid, target_tenant uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.deal_contexts d
    WHERE d.id = parent_id AND d.organization_id = target_org
      AND d.tenant_id = target_tenant
  );
$fn$;
REVOKE ALL ON FUNCTION public.deal_assembly_child_matches(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deal_assembly_child_matches(uuid,uuid,uuid)
  TO authenticated;

-- Both old and new writers may omit a compatible scope column. Populate it
-- only via a known case/organization mapping (parent) or parent FK (child).
-- Never silently overwrite a contradictory caller-supplied value.
CREATE OR REPLACE FUNCTION public.enforce_deal_assembly_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  parent_org uuid;
  parent_tenant uuid;
BEGIN
  IF TG_TABLE_NAME = 'deal_contexts' THEN
    IF NEW.organization_id IS NULL AND NEW.case_id IS NOT NULL THEN
      SELECT c.organization_id INTO NEW.organization_id
      FROM public.value_cases c WHERE c.id = NEW.case_id;
    END IF;
    IF NEW.tenant_id IS NULL AND NEW.organization_id IS NOT NULL THEN
      SELECT o.tenant_id::uuid INTO NEW.tenant_id
      FROM public.organizations o WHERE o.id = NEW.organization_id
        AND o.tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    END IF;
    IF NEW.case_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.value_cases c
      WHERE c.id = NEW.case_id AND c.organization_id = NEW.organization_id
        AND c.tenant_id = NEW.tenant_id::text
    ) THEN
      RAISE EXCEPTION 'Deal context case/tenant scope mismatch'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT d.organization_id, d.tenant_id
      INTO parent_org, parent_tenant
    FROM public.deal_contexts d WHERE d.id = NEW.deal_context_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Deal child has no visible parent' USING ERRCODE = '23514';
    END IF;
    IF NEW.organization_id IS NULL THEN NEW.organization_id := parent_org; END IF;
    IF NEW.tenant_id IS NULL THEN NEW.tenant_id := parent_tenant; END IF;
    IF NEW.organization_id IS DISTINCT FROM parent_org OR
       NEW.tenant_id IS DISTINCT FROM parent_tenant THEN
      RAISE EXCEPTION 'Deal child/parent scope mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NOT public.deal_assembly_scope_matches(NEW.organization_id, NEW.tenant_id) THEN
    RAISE EXCEPTION 'Deal organization/tenant mapping missing or mismatched'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.enforce_deal_assembly_scope() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_deal_assembly_scope() TO authenticated;

DO $guards$
DECLARE
  tbl text;
  condition text;
  policy text;
  command text;
  relation regclass;
  valid boolean;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'deal_contexts','deal_context_sources','stakeholders','use_cases'
  ] LOOP
    relation := format('public.%I', tbl)::regclass;
    condition := 'security.user_has_tenant_access(tenant_id) AND public.deal_assembly_scope_matches(organization_id, tenant_id)';
    IF tbl <> 'deal_contexts' THEN
      condition := condition ||
        ' AND public.deal_assembly_child_matches(deal_context_id, organization_id, tenant_id)';
    END IF;

    -- RESTRICTIVE policies are ANDed with ALL old/new permissive policies;
    -- the later unsafe organization_id::text policy cannot OR-grant access.
    FOREACH command IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      policy := tbl || '_verified_' || lower(command) || '_guard';
      IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polrelid = relation AND polname = policy
      ) THEN
        IF command = 'SELECT' THEN
          EXECUTE format(
            'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (%s)',
            policy, tbl, condition);
        ELSIF command = 'INSERT' THEN
          EXECUTE format(
            'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (%s)',
            policy, tbl, condition);
        ELSIF command = 'UPDATE' THEN
          EXECUTE format(
            'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
            policy, tbl, condition, condition);
        ELSE
          EXECUTE format(
            'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)',
            policy, tbl, condition);
        END IF;
      ELSE
        SELECT NOT polpermissive AND polcmd =
          CASE command WHEN 'SELECT' THEN 'r' WHEN 'INSERT' THEN 'a'
            WHEN 'UPDATE' THEN 'w' ELSE 'd' END
          INTO valid FROM pg_policy WHERE polrelid = relation AND polname = policy;
        IF NOT valid THEN
          RAISE EXCEPTION 'Conflicting existing restrictive deal scope guard for %', tbl;
        END IF;
      END IF;
    END LOOP;
    policy := tbl || '_verified_member_access';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy WHERE polrelid = relation AND polname = policy
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
        policy, tbl, condition, condition);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgrelid = relation
        AND tgname = 'enforce_deal_assembly_scope' AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER enforce_deal_assembly_scope BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_deal_assembly_scope()',
        tbl);
    END IF;
  END LOOP;
END $guards$;

-- The later historical SQL recreates each canonical update trigger. After
-- it succeeds, remove only the redundant *renamed* old trigger. In the early
-- bridge the canonical trigger is absent, so the legacy one remains active.
DO $duplicate_triggers$
DECLARE tbl text; legacy text; canonical text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['deal_contexts','stakeholders','use_cases'] LOOP
    legacy := 'legacy_deal_' || tbl || '_updated_at';
    canonical := 'update_' || tbl || '_updated_at';
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE
        tgrelid = format('public.%I',tbl)::regclass
        AND tgname = legacy AND NOT tgisinternal)
      AND EXISTS (SELECT 1 FROM pg_trigger WHERE
        tgrelid = format('public.%I',tbl)::regclass
        AND tgname = canonical AND NOT tgisinternal) THEN
      EXECUTE format('DROP TRIGGER %I ON public.%I', legacy, tbl);
    END IF;
  END LOOP;
END $duplicate_triggers$;

GRANT ALL ON public.deal_contexts, public.deal_context_sources,
  public.stakeholders, public.use_cases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_contexts,
  public.deal_context_sources, public.stakeholders, public.use_cases
  TO authenticated;
COMMIT;
