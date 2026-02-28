BEGIN;
SELECT plan(5);

SET LOCAL role TO service_role;

SELECT is(
  public.provision_tenant(
    '8d2e8d26-86ff-48e8-b89c-a8af5bcce6d2'::uuid,
    'Provision Tenant Test Org',
    'free',
    NULL,
    '{"source":"test"}'::jsonb,
    now()
  ),
  '8d2e8d26-86ff-48e8-b89c-a8af5bcce6d2'::uuid,
  'provision_tenant returns canonical organizations.id UUID'
);

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM public.organizations
    WHERE id = '8d2e8d26-86ff-48e8-b89c-a8af5bcce6d2'::uuid
  $$,
  $$ VALUES (1) $$,
  'organization row is created'
);

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM public.subscriptions
    WHERE tenant_id = '8d2e8d26-86ff-48e8-b89c-a8af5bcce6d2'::uuid
  $$,
  $$ VALUES (1) $$,
  'billing anchor subscription row is created'
);

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM public.entitlement_snapshots es
    JOIN public.subscriptions s ON s.id = es.subscription_id
    WHERE es.tenant_id = '8d2e8d26-86ff-48e8-b89c-a8af5bcce6d2'::uuid
      AND s.tenant_id = '8d2e8d26-86ff-48e8-b89c-a8af5bcce6d2'::uuid
      AND es.price_version_id = s.price_version_id
  $$,
  $$ VALUES (1) $$,
  'entitlement snapshot is created and linked to subscription/price version'
);

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM public.entitlement_snapshots
    WHERE tenant_id = '8d2e8d26-86ff-48e8-b89c-a8af5bcce6d2'::uuid
      AND superseded_at IS NULL
  $$,
  $$ VALUES (1) $$,
  'exactly one current entitlement snapshot exists after provisioning'
);

SELECT * FROM finish();
ROLLBACK;
