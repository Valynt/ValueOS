-- Provision tenant bootstrap in a single transaction.
-- SECURITY DEFINER so trusted backend can bypass caller RLS.
-- All tenant-scoped writes derive from v_tenant_id generated inside this function.

CREATE OR REPLACE FUNCTION public.provision_tenant(
  organization_name text,
  owner_user_id uuid,
  plan_tier text DEFAULT 'free',
  settings jsonb DEFAULT '{}'::jsonb,
  effective_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_trimmed_name text;
  v_plan_tier text;
  v_effective_at timestamptz := COALESCE(effective_at, now());

  v_price_version_id uuid;
  v_price_definition jsonb;

  v_subscription_id uuid;
BEGIN
  -- Input validation
  v_trimmed_name := btrim(organization_name);

  IF owner_user_id IS NULL THEN
    RAISE EXCEPTION 'owner_user_id is required'
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

  -- Normalize tiers
  v_plan_tier := CASE
    WHEN plan_tier IN ('starter', 'professional') THEN 'standard'
    ELSE COALESCE(plan_tier, 'free')
  END;

  IF v_plan_tier NOT IN ('free', 'standard', 'enterprise') THEN
    RAISE EXCEPTION 'Unsupported plan tier: %', v_plan_tier
      USING ERRCODE = '22023';
  END IF;

  v_tenant_id := gen_random_uuid();

  -- Canonical tenant record
  INSERT INTO public.tenants (id, name, settings, status, created_at, updated_at)
  VALUES (
    v_tenant_id,
    v_trimmed_name,
    COALESCE(settings, '{}'::jsonb),
    'active',
    now(),
    now()
  );

  -- Owner membership
  INSERT INTO public.user_tenants (user_id, tenant_id, role, status, created_at, updated_at)
  VALUES (owner_user_id, v_tenant_id, 'owner', 'active', now(), now())
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  -- Resolve active GLOBAL billing price version for the tier (no tenant override at provisioning time)
  SELECT bpv.id, bpv.definition
    INTO v_price_version_id, v_price_definition
  FROM public.billing_price_versions AS bpv
  WHERE bpv.status = 'active'
    AND bpv.plan_tier = v_plan_tier
    AND bpv.tenant_id IS NULL
  ORDER BY bpv.activated_at DESC NULLS LAST, bpv.created_at DESC
  LIMIT 1;

  IF v_price_version_id IS NULL THEN
    RAISE EXCEPTION 'No active global billing_price_versions row found for tier %', v_plan_tier
      USING ERRCODE = 'P0001';
  END IF;

  -- Optional: internal anchor subscription so entitlements always have a subscription_id
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
    CONCAT('internal-', v_tenant_id::text),
    CONCAT('internal-', v_tenant_id::text),
    v_plan_tier,
    'monthly',
    'active',
    date_trunc('month', v_effective_at),
    (date_trunc('month', v_effective_at) + interval '1 month' - interval '1 second'),
    COALESCE(NULLIF((v_price_definition ->> 'price_usd'), '')::numeric, 0),
    'usd',
    jsonb_build_object(
      'provisioning_source', 'public.provision_tenant',
      'mode', 'internal_anchor'
    ),
    v_price_version_id,
    now(),
    now()
  )
  RETURNING id INTO v_subscription_id;

  -- Supersede any prior snapshots (defensive; should be none on new tenant)
  UPDATE public.entitlement_snapshots
     SET superseded_at = v_effective_at
   WHERE tenant_id = v_tenant_id
     AND superseded_at IS NULL;

  -- Pin current price version on tenant (column if present, else in settings)
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'tenants'
       AND column_name = 'current_price_version_id'
  ) THEN
    UPDATE public.tenants
       SET current_price_version_id = v_price_version_id,
           updated_at = now()
     WHERE id = v_tenant_id;
  ELSE
    UPDATE public.tenants
       SET settings = COALESCE(settings, '{}'::jsonb)
                      || jsonb_build_object('current_price_version_id', v_price_version_id),
           updated_at = now()
     WHERE id = v_tenant_id;
  END IF;

  -- Initial entitlement snapshot
  INSERT INTO public.entitlement_snapshots (
    tenant_id,
    subscription_id,
    price_version_id,
    entitlements,
    effective_at,
    created_at,
    updated_at
  )
  VALUES (
    v_tenant_id,
    v_subscription_id,
    v_price_version_id,
    COALESCE(v_price_definition, '{}'::jsonb),
    v_effective_at,
    now(),
    now()
  );

  RETURN v_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.provision_tenant(text, uuid, text, jsonb, timestamptz)
IS 'Provision tenant + owner membership + pinned global billing version + initial entitlement snapshot in one SECURITY DEFINER transaction. Tenant id is generated in-function to prevent cross-tenant targeting.';

REVOKE ALL ON FUNCTION public.provision_tenant(text, uuid, text, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_tenant(text, uuid, text, jsonb, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.provision_tenant(text, uuid, text, jsonb, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.provision_tenant(text, uuid, text, jsonb, timestamptz) TO service_role;
