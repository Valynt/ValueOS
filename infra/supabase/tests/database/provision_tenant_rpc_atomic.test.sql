BEGIN;
SELECT plan(6);

SET LOCAL role TO service_role;

WITH provisioned AS (
  SELECT public.provision_tenant(
    'Provision Tenant RPC Atomic ' || substr(md5(clock_timestamp()::text), 1, 8),
    '00000000-0000-0000-0000-000000000123'::uuid
  ) AS tenant_id
)
SELECT ok(
  (SELECT tenant_id IS NOT NULL FROM provisioned),
  'provision_tenant returns canonical tenant UUID'
);

WITH provisioned AS (
  SELECT public.provision_tenant(
    'Provision Tenant RPC Atomic Linked ' || substr(md5(clock_timestamp()::text), 1, 8),
    '00000000-0000-0000-0000-000000000124'::uuid
  ) AS tenant_id
)
SELECT results_eq(
  $$
    SELECT COUNT(*)::bigint
    FROM provisioned p
    JOIN public.tenants t ON t.id = p.tenant_id
    JOIN public.organizations o ON o.id = p.tenant_id AND o.tenant_id = p.tenant_id
    JOIN public.user_tenants ut ON ut.tenant_id = p.tenant_id AND ut.user_id = '00000000-0000-0000-0000-000000000124'::uuid
    JOIN public.subscriptions s ON s.tenant_id = p.tenant_id
    JOIN public.entitlement_snapshots es ON es.tenant_id = p.tenant_id AND es.subscription_id = s.id
  $$,
  $$ VALUES (1::bigint) $$,
  'provision_tenant creates tenants/organizations/user_tenants/subscriptions/entitlement_snapshots atomically'
);

WITH provisioned AS (
  SELECT public.provision_tenant(
    'Provision Tenant RPC Atomic Billing ' || substr(md5(clock_timestamp()::text), 1, 8),
    '00000000-0000-0000-0000-000000000125'::uuid
  ) AS tenant_id
)
SELECT ok(
  EXISTS (
    SELECT 1
    FROM provisioned p
    JOIN public.subscriptions s ON s.tenant_id = p.tenant_id
    JOIN public.billing_price_versions bpv ON bpv.id = s.price_version_id
    WHERE bpv.status = 'active'
      AND bpv.plan_tier = 'free'
      AND bpv.tenant_id IS NULL
  ),
  'provision_tenant subscription references active global free billing_price_versions row'
);

WITH provisioned AS (
  SELECT public.provision_tenant(
    'Provision Tenant RPC Atomic Snapshot ' || substr(md5(clock_timestamp()::text), 1, 8),
    '00000000-0000-0000-0000-000000000126'::uuid
  ) AS tenant_id
)
SELECT ok(
  EXISTS (
    SELECT 1
    FROM provisioned p
    JOIN public.subscriptions s ON s.tenant_id = p.tenant_id
    JOIN public.entitlement_snapshots es
      ON es.tenant_id = p.tenant_id
     AND es.subscription_id = s.id
     AND es.price_version_id = s.price_version_id
  ),
  'provision_tenant entitlement snapshot references bootstrap subscription and price version'
);

SELECT throws_ok(
  $$ SELECT public.provision_tenant('', '00000000-0000-0000-0000-000000000127'::uuid) $$,
  'organization_name is required',
  'provision_tenant validates organization_name'
);

SELECT throws_ok(
  $$ SELECT public.provision_tenant('Provision Tenant Missing User', NULL::uuid) $$,
  'user_id is required',
  'provision_tenant validates user_id'
);

SELECT * FROM finish();
ROLLBACK;
