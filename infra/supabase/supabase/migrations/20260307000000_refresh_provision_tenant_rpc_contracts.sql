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
  v_now timestamptz := now();
  v_price_version_id uuid;
  v_price_definition jsonb;
  v_subscription_id uuid;
BEGIN
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

  INSERT INTO public.tenants (id, name, settings, status, created_at, updated_at)
  VALUES (v_tenant_id, v_trimmed_name, '{}'::jsonb, 'active', v_now, v_now);

  INSERT INTO public.organizations (id, tenant_id, name, tier, is_active, created_at, updated_at)
  VALUES (v_tenant_id, v_tenant_id, v_trimmed_name, 'free', true, v_now, v_now);

  INSERT INTO public.user_tenants (user_id, tenant_id, role, status)
  VALUES (user_id, v_tenant_id, 'owner', 'active')
  ON CONFLICT DO NOTHING;

  SELECT bpv.id, bpv.definition
    INTO v_price_version_id, v_price_definition
  FROM public.billing_price_versions AS bpv
  WHERE bpv.status = 'active'
    AND bpv.plan_tier = 'free'
    AND bpv.tenant_id IS NULL
  ORDER BY bpv.activated_at DESC NULLS LAST, bpv.created_at DESC, bpv.id DESC
  LIMIT 1;

  IF v_price_version_id IS NULL THEN
    RAISE EXCEPTION 'No active global billing price version for free tier';
  END IF;

  INSERT INTO public.subscriptions (
    tenant_id,
    stripe_subscription_id,
    stripe_customer_id,
    plan_tier,
    billing_period,
    status,
    current_period_start,
    current_period_end,
    amount,
    currency,
    metadata,
    price_version_id,
    created_at,
    updated_at
  )
  VALUES (
    v_tenant_id,
    'bootstrap-sub-' || v_tenant_id::text,
    'bootstrap-cus-' || v_tenant_id::text,
    'free',
    'monthly',
    'active',
    v_now,
    v_now + interval '1 month',
    0,
    'usd',
    jsonb_build_object(
      'provisioned_by', 'provision_tenant',
      'bootstrap', true,
      'owner_user_id', user_id
    ),
    v_price_version_id,
    v_now,
    v_now
  )
  RETURNING id INTO v_subscription_id;

  INSERT INTO public.entitlement_snapshots (
    tenant_id,
    subscription_id,
    price_version_id,
    entitlements,
    effective_at,
    created_at
  )
  VALUES (
    v_tenant_id,
    v_subscription_id,
    v_price_version_id,
    COALESCE(v_price_definition, '{}'::jsonb),
    v_now,
    v_now
  );

  RETURN v_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.provision_tenant(text, uuid)
IS 'Atomically provisions canonical tenant records: tenants + organizations + owner membership + bootstrap subscription + entitlement snapshot using active billing contracts. Returns organizations.id/tenants.id UUID.';

REVOKE ALL ON FUNCTION public.provision_tenant(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_tenant(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.provision_tenant(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.provision_tenant(text, uuid) TO service_role;
