-- Tenant provisioning RPC consolidates tenant bootstrap in a single transaction.
-- SECURITY DEFINER is required so trusted backend flows can bypass caller RLS while
-- still writing strictly tenant-scoped rows derived inside this function.

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.provision_tenant(
  organization_name text,
  user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_trimmed_name text;
  v_price_version_id uuid;
  v_price_definition jsonb;
  v_subscription_id uuid;
BEGIN
  -- Strict input validation
  v_trimmed_name := btrim(organization_name);

  IF user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_trimmed_name IS NULL OR char_length(v_trimmed_name) = 0 THEN
    RAISE EXCEPTION 'organization_name is required'
      USING ERRCODE = '22023';
  END IF;

  IF char_length(v_trimmed_name) > 120 THEN
    RAISE EXCEPTION 'organization_name must be <= 120 characters'
      USING ERRCODE = '22023';
  END IF;

  v_tenant_id := gen_random_uuid();

  -- Canonical tenant record
  INSERT INTO public.tenants (id, name, settings, status)
  VALUES (v_tenant_id, v_trimmed_name, '{}'::jsonb, 'active');

  -- Owner membership needed by tenant-aware follow-up provisioning steps.
  INSERT INTO public.user_tenants (user_id, tenant_id, role, status)
  VALUES (user_id, v_tenant_id, 'owner', 'active')
  ON CONFLICT DO NOTHING;

  -- Resolve active global billing version (tenant override not allowed at provisioning time).
  SELECT bpv.id, bpv.definition
    INTO v_price_version_id, v_price_definition
  FROM public.billing_price_versions AS bpv
  WHERE bpv.status = 'active'
    AND bpv.plan_tier = 'free'
    AND bpv.tenant_id IS NULL
  ORDER BY bpv.activated_at DESC NULLS LAST, bpv.created_at DESC
  LIMIT 1;

  IF v_price_version_id IS NULL THEN
    RAISE EXCEPTION 'No active global billing price version for free tier'
      USING ERRCODE = 'P0001';
  END IF;

  -- Pin price version on tenant schema-equivalent field.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'current_price_version_id'
  ) THEN
    UPDATE public.tenants
      SET current_price_version_id = v_price_version_id
    WHERE id = v_tenant_id;
  ELSE
    UPDATE public.tenants
      SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('current_price_version_id', v_price_version_id)
    WHERE id = v_tenant_id;
  END IF;

  -- Snapshot should reference a subscription id when present, otherwise generate a stable bootstrap id.
  SELECT s.id
    INTO v_subscription_id
  FROM public.subscriptions AS s
  WHERE s.tenant_id = v_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  v_subscription_id := COALESCE(v_subscription_id, gen_random_uuid());

  INSERT INTO public.entitlement_snapshots (
    tenant_id,
    subscription_id,
    price_version_id,
    entitlements,
    effective_at
  )
  VALUES (
    v_tenant_id,
    v_subscription_id,
    v_price_version_id,
    COALESCE(v_price_definition, '{}'::jsonb),
    now()
  );

  RETURN v_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.provision_tenant(text, uuid)
IS 'Provision tenant + owner membership + pinned billing version + initial entitlement snapshot in one SECURITY DEFINER transaction. Safe RLS bypass: tenant_id is generated once in-function and reused for all writes, preventing cross-tenant targeting by caller input.';

REVOKE ALL ON FUNCTION public.provision_tenant(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_tenant(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.provision_tenant(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.provision_tenant(text, uuid) TO service_role;
