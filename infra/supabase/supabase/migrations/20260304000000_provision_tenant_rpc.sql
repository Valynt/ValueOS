SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.provision_tenant(
  p_organization_id uuid,
  p_name text,
  p_plan_tier text DEFAULT 'free',
  p_owner_user_id uuid DEFAULT NULL,
  p_settings jsonb DEFAULT '{}'::jsonb,
  p_effective_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_tier text;
  v_effective_at timestamptz := COALESCE(p_effective_at, now());
  v_price_version_id uuid;
  v_price_definition jsonb;
  v_subscription_id uuid;
BEGIN
  v_plan_tier := CASE
    WHEN p_plan_tier = 'starter' THEN 'standard'
    WHEN p_plan_tier = 'professional' THEN 'standard'
    ELSE p_plan_tier
  END;

  IF v_plan_tier NOT IN ('free', 'standard', 'enterprise') THEN
    RAISE EXCEPTION 'Unsupported plan tier: %', p_plan_tier;
  END IF;

  INSERT INTO public.organizations (
    id,
    tenant_id,
    name,
    tier,
    is_active,
    settings,
    created_at,
    updated_at
  )
  VALUES (
    p_organization_id,
    p_organization_id,
    p_name,
    v_plan_tier,
    true,
    COALESCE(p_settings, '{}'::jsonb),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    tier = EXCLUDED.tier,
    is_active = EXCLUDED.is_active,
    settings = public.organizations.settings || EXCLUDED.settings,
    updated_at = now();

  IF p_owner_user_id IS NOT NULL THEN
    INSERT INTO public.user_tenants (user_id, tenant_id, status, role)
    VALUES (p_owner_user_id, p_organization_id, 'active', 'owner')
    ON CONFLICT (user_id, tenant_id) DO NOTHING;
  END IF;

  SELECT bpv.id, bpv.definition
  INTO v_price_version_id, v_price_definition
  FROM public.billing_price_versions bpv
  WHERE bpv.status = 'active'
    AND bpv.plan_tier = v_plan_tier
    AND bpv.tenant_id IS NULL
  ORDER BY bpv.activated_at DESC NULLS LAST, bpv.created_at DESC
  LIMIT 1;

  IF v_price_version_id IS NULL THEN
    RAISE EXCEPTION 'No active billing_price_versions row found for tier %', v_plan_tier;
  END IF;

  SELECT s.id
  INTO v_subscription_id
  FROM public.subscriptions s
  WHERE s.tenant_id = p_organization_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_subscription_id IS NULL THEN
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
      price_version_id
    )
    VALUES (
      p_organization_id,
      CONCAT('internal-', p_organization_id::text),
      CONCAT('internal-', p_organization_id::text),
      v_plan_tier,
      'monthly',
      'active',
      date_trunc('month', v_effective_at),
      (date_trunc('month', v_effective_at) + interval '1 month' - interval '1 second'),
      COALESCE((v_price_definition ->> 'price_usd')::numeric, 0),
      'usd',
      jsonb_build_object('provisioning_source', 'public.provision_tenant', 'mode', 'internal_anchor'),
      v_price_version_id
    )
    RETURNING id INTO v_subscription_id;
  END IF;

  UPDATE public.entitlement_snapshots
  SET superseded_at = v_effective_at
  WHERE tenant_id = p_organization_id
    AND superseded_at IS NULL;

  INSERT INTO public.entitlement_snapshots (
    tenant_id,
    subscription_id,
    price_version_id,
    entitlements,
    effective_at
  )
  VALUES (
    p_organization_id,
    v_subscription_id,
    v_price_version_id,
    v_price_definition,
    v_effective_at
  );

  RETURN p_organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_tenant(uuid, text, text, uuid, jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_tenant(uuid, text, text, uuid, jsonb, timestamptz) TO service_role;
