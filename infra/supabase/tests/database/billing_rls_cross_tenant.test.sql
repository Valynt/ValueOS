-- tests/database/billing_rls_cross_tenant.test.sql
-- Validate billing-table tenant isolation using JWT tenant_id claims.

BEGIN;
SELECT plan(8);

-- Seed fixture rows with elevated role.
SET LOCAL role TO service_role;

INSERT INTO public.usage_policies (id, tenant_id, meter_key, enforcement)
VALUES
  ('71000000-0000-0000-0000-000000000001'::uuid, '81000000-0000-0000-0000-000000000001'::uuid, 'ai_tokens', 'hard_lock'),
  ('71000000-0000-0000-0000-000000000002'::uuid, '81000000-0000-0000-0000-000000000002'::uuid, 'ai_tokens', 'hard_lock')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.billing_approval_requests (
  approval_id,
  tenant_id,
  requested_by_user_id,
  action_type,
  payload,
  status
)
VALUES
  (
    '72000000-0000-0000-0000-000000000001'::uuid,
    '81000000-0000-0000-0000-000000000001'::uuid,
    '91000000-0000-0000-0000-000000000001'::uuid,
    'plan_change',
    '{"from":"free","to":"standard"}'::jsonb,
    'pending'
  ),
  (
    '72000000-0000-0000-0000-000000000002'::uuid,
    '81000000-0000-0000-0000-000000000002'::uuid,
    '91000000-0000-0000-0000-000000000002'::uuid,
    'plan_change',
    '{"from":"free","to":"enterprise"}'::jsonb,
    'pending'
  )
ON CONFLICT (approval_id) DO NOTHING;

INSERT INTO public.entitlement_snapshots (
  id,
  tenant_id,
  subscription_id,
  price_version_id,
  entitlements,
  effective_at
)
SELECT
  '73000000-0000-0000-0000-000000000001'::uuid,
  '81000000-0000-0000-0000-000000000001'::uuid,
  '74000000-0000-0000-0000-000000000001'::uuid,
  bpv.id,
  '{"meter":"ai_tokens","included":10000}'::jsonb,
  now()
FROM public.billing_price_versions bpv
WHERE bpv.plan_tier = 'free'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.entitlement_snapshots (
  id,
  tenant_id,
  subscription_id,
  price_version_id,
  entitlements,
  effective_at
)
SELECT
  '73000000-0000-0000-0000-000000000002'::uuid,
  '81000000-0000-0000-0000-000000000002'::uuid,
  '74000000-0000-0000-0000-000000000002'::uuid,
  bpv.id,
  '{"meter":"ai_tokens","included":10000}'::jsonb,
  now()
FROM public.billing_price_versions bpv
WHERE bpv.plan_tier = 'standard'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Tenant A session context.
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO json_build_object(
  'sub', 'a1000000-0000-0000-0000-000000000001',
  'role', 'authenticated',
  'tenant_id', '81000000-0000-0000-0000-000000000001'
)::text;

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM public.usage_policies
  $$,
  $$ VALUES (1) $$,
  'Tenant A sees only Tenant A usage_policies rows'
);

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM public.billing_approval_requests
  $$,
  $$ VALUES (1) $$,
  'Tenant A sees only Tenant A billing_approval_requests rows'
);

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM public.entitlement_snapshots
  $$,
  $$ VALUES (1) $$,
  'Tenant A sees only Tenant A entitlement_snapshots rows'
);

-- WITH CHECK must deny cross-tenant inserts.
SELECT throws_ok(
  $$
    INSERT INTO public.billing_approval_requests (
      approval_id, tenant_id, requested_by_user_id, action_type, payload, status
    ) VALUES (
      '72000000-0000-0000-0000-000000000099'::uuid,
      '81000000-0000-0000-0000-000000000002'::uuid,
      '91000000-0000-0000-0000-000000000099'::uuid,
      'plan_change',
      '{"attempt":"cross-tenant"}'::jsonb,
      'pending'
    )
  $$,
  'new row violates row-level security policy for table "billing_approval_requests"',
  'Tenant A cannot INSERT billing_approval_requests for Tenant B'
);

-- Tenant B session context.
SET LOCAL request.jwt.claims TO json_build_object(
  'sub', 'b1000000-0000-0000-0000-000000000001',
  'role', 'authenticated',
  'tenant_id', '81000000-0000-0000-0000-000000000002'
)::text;

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM public.usage_policies
  $$,
  $$ VALUES (1) $$,
  'Tenant B sees only Tenant B usage_policies rows'
);

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM public.billing_approval_requests
  $$,
  $$ VALUES (1) $$,
  'Tenant B sees only Tenant B billing_approval_requests rows'
);

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM public.entitlement_snapshots
  $$,
  $$ VALUES (1) $$,
  'Tenant B sees only Tenant B entitlement_snapshots rows'
);

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM public.billing_meters
  $$,
  $$ VALUES (6) $$,
  'billing_meters remains intentionally global for authenticated users'
);

SELECT * FROM finish();
ROLLBACK;
