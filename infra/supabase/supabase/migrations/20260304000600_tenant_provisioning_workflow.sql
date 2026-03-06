SET search_path = public, pg_temp;

CREATE TABLE IF NOT EXISTS public.tenant_provisioning_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  request_key text NOT NULL,
  organization_id text NOT NULL,
  subscription_id uuid,
  price_version_id uuid,
  entitlement_snapshot_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, request_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_provisioning_requests_tenant_created
  ON public.tenant_provisioning_requests (tenant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entitlement_snapshots_one_current_per_tenant
  ON public.entitlement_snapshots (tenant_id)
  WHERE superseded_at IS NULL;

CREATE OR REPLACE FUNCTION public.tenant_provisioning_workflow(
  p_tenant_id text,
  p_organization_name text,
  p_owner_user_id uuid,
  p_selected_tier text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_subscription_status text,
  p_subscription_billing_period text,
  p_subscription_amount numeric,
  p_subscription_currency text,
  p_request_key text
)
RETURNS TABLE (
  tenant_id text,
  organization_id text,
  subscription_id uuid,
  price_version_id uuid,
  entitlement_snapshot_id uuid,
  idempotent_replay boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_tenant_uuid uuid;
  v_existing_request public.tenant_provisioning_requests%ROWTYPE;
  v_subscription_id uuid;
  v_price_version_id uuid;
  v_snapshot_id uuid;
  v_existing_snapshot_id uuid;
BEGIN
  IF p_request_key IS NULL OR btrim(p_request_key) = '' THEN
    RAISE EXCEPTION 'p_request_key must be provided';
  END IF;

  IF p_selected_tier NOT IN ('free', 'standard', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid p_selected_tier: %', p_selected_tier;
  END IF;

  BEGIN
    v_tenant_uuid := p_tenant_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'p_tenant_id must be a valid UUID for billing entities: %', p_tenant_id;
  END;

  SELECT *
    INTO v_existing_request
  FROM public.tenant_provisioning_requests
  WHERE tenant_id = p_tenant_id
    AND request_key = p_request_key
  FOR UPDATE;

  IF FOUND
     AND v_existing_request.subscription_id IS NOT NULL
     AND v_existing_request.price_version_id IS NOT NULL
     AND v_existing_request.entitlement_snapshot_id IS NOT NULL THEN
    RETURN QUERY SELECT
      v_existing_request.tenant_id,
      v_existing_request.organization_id,
      v_existing_request.subscription_id,
      v_existing_request.price_version_id,
      v_existing_request.entitlement_snapshot_id,
      true;
    RETURN;
  END IF;

  INSERT INTO public.tenants (id, name, settings, status, created_at, updated_at)
  VALUES (p_tenant_id, p_organization_name, '{}'::jsonb, 'active', v_now, v_now)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        status = 'active',
        updated_at = v_now;

  INSERT INTO public.organizations (id, tenant_id, name, tier, is_active, updated_at)
  VALUES (p_tenant_id, p_tenant_id, p_organization_name, p_selected_tier, true, v_now)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        tier = EXCLUDED.tier,
        is_active = true,
        updated_at = v_now;

  SELECT bpv.id
    INTO v_price_version_id
  FROM public.billing_price_versions bpv
  WHERE bpv.status = 'active'
    AND bpv.plan_tier = p_selected_tier
    AND (bpv.tenant_id = v_tenant_uuid OR bpv.tenant_id IS NULL)
  ORDER BY (bpv.tenant_id = v_tenant_uuid) DESC,
           bpv.activated_at DESC NULLS LAST,
           bpv.created_at DESC,
           bpv.id DESC
  LIMIT 1;

  IF v_price_version_id IS NULL THEN
    RAISE EXCEPTION 'No active billing_price_versions row found for tier %', p_selected_tier;
  END IF;

  SELECT s.id
    INTO v_subscription_id
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
    AND s.stripe_subscription_id = p_stripe_subscription_id
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
      price_version_id,
      created_at,
      updated_at
    )
    VALUES (
      p_tenant_id,
      p_stripe_subscription_id,
      p_stripe_customer_id,
      p_selected_tier,
      p_subscription_billing_period,
      p_subscription_status,
      v_now,
      v_now + interval '1 month',
      p_subscription_amount,
      COALESCE(p_subscription_currency, 'usd'),
      jsonb_build_object(
        'provisioned_by', 'tenant_provisioning_workflow',
        'provisioning_request_key', p_request_key,
        'owner_user_id', p_owner_user_id
      ),
      v_price_version_id,
      v_now,
      v_now
    )
    RETURNING id INTO v_subscription_id;
  ELSE
    UPDATE public.subscriptions
    SET stripe_customer_id = p_stripe_customer_id,
        plan_tier = p_selected_tier,
        billing_period = p_subscription_billing_period,
        status = p_subscription_status,
        amount = p_subscription_amount,
        currency = COALESCE(p_subscription_currency, currency, 'usd'),
        price_version_id = v_price_version_id,
        updated_at = v_now,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'provisioning_request_key', p_request_key,
          'owner_user_id', p_owner_user_id
        )
    WHERE id = v_subscription_id;
  END IF;

  SELECT es.id
    INTO v_existing_snapshot_id
  FROM public.entitlement_snapshots es
  WHERE es.tenant_id = v_tenant_uuid
    AND es.subscription_id = v_subscription_id
    AND es.price_version_id = v_price_version_id
    AND es.superseded_at IS NULL
  ORDER BY es.created_at DESC
  LIMIT 1;

  IF v_existing_snapshot_id IS NOT NULL THEN
    v_snapshot_id := v_existing_snapshot_id;
  ELSE
    UPDATE public.entitlement_snapshots
    SET superseded_at = v_now
    WHERE tenant_id = v_tenant_uuid
      AND superseded_at IS NULL;

    INSERT INTO public.entitlement_snapshots (
      tenant_id,
      subscription_id,
      price_version_id,
      entitlements,
      effective_at,
      superseded_at,
      created_at
    )
    SELECT
      v_tenant_uuid,
      v_subscription_id,
      bpv.id,
      bpv.definition,
      v_now,
      NULL,
      v_now
    FROM public.billing_price_versions bpv
    WHERE bpv.id = v_price_version_id
    RETURNING id INTO v_snapshot_id;
  END IF;

  INSERT INTO public.tenant_provisioning_requests (
    tenant_id,
    request_key,
    organization_id,
    subscription_id,
    price_version_id,
    entitlement_snapshot_id,
    created_at,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_request_key,
    p_tenant_id,
    v_subscription_id,
    v_price_version_id,
    v_snapshot_id,
    v_now,
    v_now
  )
  ON CONFLICT (tenant_id, request_key) DO UPDATE
    SET subscription_id = EXCLUDED.subscription_id,
        price_version_id = EXCLUDED.price_version_id,
        entitlement_snapshot_id = EXCLUDED.entitlement_snapshot_id,
        updated_at = v_now;

  RETURN QUERY SELECT
    p_tenant_id,
    p_tenant_id,
    v_subscription_id,
    v_price_version_id,
    v_snapshot_id,
    false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_provisioning_workflow(
  text, text, uuid, text, text, text, text, text, numeric, text, text
) TO service_role;
