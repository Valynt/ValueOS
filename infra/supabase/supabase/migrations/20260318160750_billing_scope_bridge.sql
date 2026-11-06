-- Additive billing compatibility bridge. Fresh/replay path before 20260318160751;
-- identical forward copy repairs installations which already applied that file.
-- Never equate an organization UUID to a tenant ID. Never assign a global price.
-- rls: existing tables are tenant_scoped; price versions additionally allow
-- authenticated global SELECT. Global meter catalog is unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

LOCK TABLE public.organizations, public.billing_price_versions,
  public.usage_policies, public.billing_approval_policies,
  public.billing_approval_requests, public.entitlement_snapshots
  IN SHARE ROW EXCLUSIVE MODE;

DO $billing$
DECLARE
  tbl text;
  col text;
  observed regtype;
  incompatible boolean;
  had_tenant_column boolean;
  uuid_pattern constant text :=
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  -- The organization-first billing DDL is NOT yet a compatible replacement
  -- for the initial-release contract: it forbids global price rows, uses a
  -- different approvals PK and lacks the tenant/action upsert constraint.
  -- Reject this observed shape rather than claim a silent upgrade succeeded.
  IF EXISTS (
    SELECT 1 FROM pg_attribute
      WHERE attrelid = 'public.billing_price_versions'::regclass
        AND attname = 'organization_id' AND attnotnull AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'billing_price_versions'
        AND indexname = 'idx_billing_price_versions_global_tag_tier_unique'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
      WHERE attrelid = 'public.billing_approval_requests'::regclass
        AND attname = 'approval_id' AND atttypid = 'uuid'::regtype
        AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.billing_approval_policies'::regclass
        AND conname = 'billing_approval_policies_tenant_action_unique'
        AND contype = 'u'
  ) THEN
    RAISE EXCEPTION 'Organization-first billing schema is incompatible with global pricing and legacy approval callers; reviewed forward repair required'
      USING ERRCODE = '23514';
  END IF;

  -- Create only missing scope columns. Existing types are never rewritten.
  FOREACH tbl IN ARRAY ARRAY[
    'billing_price_versions', 'usage_policies', 'billing_approval_policies',
    'billing_approval_requests', 'entitlement_snapshots'
  ] LOOP
    SELECT EXISTS (SELECT 1 FROM pg_attribute
      WHERE attrelid = format('public.%I', tbl)::regclass
        AND attname = 'tenant_id' AND NOT attisdropped)
      INTO had_tenant_column;
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid', tbl);
    FOREACH col IN ARRAY ARRAY['tenant_id', 'organization_id'] LOOP
      SELECT atttypid::regtype INTO observed
      FROM pg_attribute WHERE attrelid = format('public.%I', tbl)::regclass
        AND attname = col AND NOT attisdropped;
      IF observed IS DISTINCT FROM 'uuid'::regtype THEN
        RAISE EXCEPTION 'Billing %.% must be UUID; manual data-safe reconciliation required',
          tbl, col USING ERRCODE = '42804';
      END IF;
    END LOOP;

    -- If an earlier tenant_id column existed, NULL pricing rows were global.
    -- Do not convert one into a tenant price merely because an org is present.
    IF tbl = 'billing_price_versions' AND had_tenant_column THEN
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.billing_price_versions WHERE tenant_id IS NULL AND organization_id IS NOT NULL)'
        INTO incompatible;
      IF incompatible THEN
        RAISE EXCEPTION 'Global billing price has an organization without tenant scope; ownership decision required'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    -- An organization-only row can be given a tenant only from an explicit,
    -- existing organizations.id -> organizations.tenant_id relationship.
    -- Contradictions, missing orgs and non-UUID tenant IDs reject atomically.
    EXECUTE format($q$
      SELECT EXISTS (
        SELECT 1 FROM public.%I AS b
        LEFT JOIN public.organizations AS o ON o.id = b.organization_id
        WHERE b.organization_id IS NOT NULL AND
          (o.id IS NULL OR o.tenant_id !~ %L OR
            (b.tenant_id IS NOT NULL AND b.tenant_id::text <> o.tenant_id))
      )
    $q$, tbl, uuid_pattern) INTO incompatible;
    IF incompatible THEN
      RAISE EXCEPTION 'Billing % has missing, non-UUID or contradictory organization/tenant ownership; manual reconciliation required',
        tbl USING ERRCODE = '23514';
    END IF;

    -- A verified backfill changes only previously ABSENT tenant scope fields.
    -- Prices with both columns NULL are GLOBAL and must remain global.
    EXECUTE format($q$
      UPDATE public.%I AS b SET tenant_id = o.tenant_id::uuid
      FROM public.organizations AS o
      WHERE b.organization_id = o.id AND b.tenant_id IS NULL
    $q$, tbl);

    IF tbl <> 'billing_price_versions' THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE tenant_id IS NULL)', tbl)
        INTO incompatible;
      IF incompatible THEN
        RAISE EXCEPTION 'Billing % contains unowned rows; manual reconciliation required',
          tbl USING ERRCODE = '23514';
      END IF;
    END IF;
  END LOOP;
END $billing$;

-- SECURITY INVOKER is intentional: membership and organizations RLS apply.
-- Existing tenant-only rows have NULL organization_id and remain valid.
CREATE OR REPLACE FUNCTION public.billing_scope_org_matches_tenant(
  target_org uuid, target_tenant uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $scope$
  SELECT target_org IS NULL
     OR (target_tenant IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.organizations o
       WHERE o.id = target_org AND o.tenant_id = target_tenant::text
     ));
$scope$;
REVOKE ALL ON FUNCTION public.billing_scope_org_matches_tenant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_scope_org_matches_tenant(uuid, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_billing_scope_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $scope$
BEGIN
  IF NEW.organization_id IS NOT NULL
     AND NOT public.billing_scope_org_matches_tenant(NEW.organization_id, NEW.tenant_id) THEN
    RAISE EXCEPTION 'Billing organization/tenant ownership mismatch; manual reconciliation required'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$scope$;
REVOKE ALL ON FUNCTION public.enforce_billing_scope_organization() FROM PUBLIC;

DO $policy$
DECLARE
  tbl text;
  relation regclass;
  read_condition text;
  write_condition text;
  membership_condition text;
  consistency_condition text;
  policy_name text;
  command text;
  verdict boolean;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'billing_price_versions', 'usage_policies', 'billing_approval_policies',
    'billing_approval_requests', 'entitlement_snapshots'
  ] LOOP
    relation := format('public.%I', tbl)::regclass;
    consistency_condition := format(
      'public.billing_scope_org_matches_tenant(organization_id, tenant_id)'
    );
    membership_condition := format(
      'security.user_has_tenant_access(tenant_id) AND %s', consistency_condition
    );
    read_condition := membership_condition;
    write_condition := membership_condition;
    IF tbl = 'billing_price_versions' THEN
      read_condition := '(tenant_id IS NULL OR security.user_has_tenant_access(tenant_id)) AND ' || consistency_condition;
      write_condition := 'tenant_id IS NOT NULL AND ' || membership_condition;
    END IF;

    -- A restrictive guard intersects ALL legacy permissive policies. This
    -- prevents the later organization_id::text policies from OR-granting rows.
    policy_name := tbl || '_scope_read_guard';
    IF NOT EXISTS (SELECT 1 FROM pg_policy
      WHERE polrelid = relation AND polname = policy_name) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (%s)',
        policy_name, tbl, read_condition);
    ELSE
      SELECT NOT polpermissive AND polcmd = 'r' INTO verdict FROM pg_policy
        WHERE polrelid = relation AND polname = policy_name;
      IF NOT verdict THEN RAISE EXCEPTION 'Conflicting billing read guard on %', tbl; END IF;
    END IF;

    FOREACH command IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE'] LOOP
      policy_name := tbl || '_scope_' || lower(command) || '_guard';
      IF NOT EXISTS (SELECT 1 FROM pg_policy
        WHERE polrelid = relation AND polname = policy_name) THEN
        IF command = 'INSERT' THEN
          EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (%s)',
            policy_name, tbl, write_condition);
        ELSIF command = 'UPDATE' THEN
          EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
            policy_name, tbl, write_condition, write_condition);
        ELSE
          EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)',
            policy_name, tbl, write_condition);
        END IF;
      ELSE
        SELECT NOT polpermissive AND polcmd =
          CASE command WHEN 'INSERT' THEN 'a' WHEN 'UPDATE' THEN 'w' ELSE 'd' END
          INTO verdict FROM pg_policy WHERE polrelid = relation AND polname = policy_name;
        IF NOT verdict THEN RAISE EXCEPTION 'Conflicting billing write guard on %', tbl; END IF;
      END IF;
    END LOOP;

    -- Tenant-scoped permissive path, constrained by the RESTRICTIVE guards.
    -- Required for organization-only deployments and legacy RLS compatibility.
    policy_name := tbl || '_scope_member_access';
    IF NOT EXISTS (SELECT 1 FROM pg_policy
      WHERE polrelid = relation AND polname = policy_name) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
        policy_name, tbl, read_condition, write_condition
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid = relation AND tgname = 'enforce_billing_scope_organization'
        AND NOT tgisinternal) THEN
      EXECUTE format(
        'CREATE TRIGGER enforce_billing_scope_organization BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_billing_scope_organization()',
        tbl
      );
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $policy$;

-- Restore only the already-established service and authenticated grants.
-- This also makes reapplication after the paired write-freeze rollback possible.
GRANT ALL ON public.billing_price_versions, public.usage_policies,
  public.billing_approval_policies, public.billing_approval_requests,
  public.entitlement_snapshots TO service_role;
GRANT SELECT ON public.billing_price_versions, public.usage_policies,
  public.billing_approval_policies, public.billing_approval_requests,
  public.entitlement_snapshots TO authenticated;
GRANT INSERT, UPDATE ON public.billing_approval_requests TO authenticated;
COMMIT;
