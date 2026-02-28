-- Semantic memory namespace boundary tests
BEGIN;
SELECT plan(6);

INSERT INTO public.semantic_memory (id, type, content, metadata, organization_id, auth0_sub, session_id)
VALUES
  (
    '90000000-0000-0000-0000-000000000001'::uuid,
    'value_proposition',
    'tenant-a user-1',
    '{"agentType":"test","organization_id":"00000000-0000-0000-0000-0000000000a1","auth0_sub":"auth0|same-user","session_id":"session-a"}'::jsonb,
    '00000000-0000-0000-0000-0000000000a1'::uuid,
    'auth0|same-user',
    'session-a'
  ),
  (
    '90000000-0000-0000-0000-000000000002'::uuid,
    'value_proposition',
    'tenant-b user-1',
    '{"agentType":"test","organization_id":"00000000-0000-0000-0000-0000000000b2","auth0_sub":"auth0|same-user","session_id":"session-b"}'::jsonb,
    '00000000-0000-0000-0000-0000000000b2'::uuid,
    'auth0|same-user',
    'session-b'
  ),
  (
    '90000000-0000-0000-0000-000000000003'::uuid,
    'value_proposition',
    'tenant-a user-2',
    '{"agentType":"test","organization_id":"00000000-0000-0000-0000-0000000000a1","auth0_sub":"auth0|other-user","session_id":"session-c"}'::jsonb,
    '00000000-0000-0000-0000-0000000000a1'::uuid,
    'auth0|other-user',
    'session-c'
  )
ON CONFLICT (id) DO NOTHING;

SELECT results_eq(
  $$
    SELECT array_agg(content ORDER BY content)
    FROM public.search_semantic_memory(
      NULL::public.vector,
      0,
      10,
      'value_proposition',
      NULL,
      NULL,
      NULL,
      '00000000-0000-0000-0000-0000000000a1'::uuid,
      'auth0|same-user',
      NULL
    )
  $$,
  $$VALUES (ARRAY['tenant-a user-1']::text[])$$,
  'same user in different tenant only returns rows from requested tenant'
);

SELECT results_eq(
  $$
    SELECT array_agg(content ORDER BY content)
    FROM public.search_semantic_memory(
      NULL::public.vector,
      0,
      10,
      'value_proposition',
      NULL,
      NULL,
      NULL,
      '00000000-0000-0000-0000-0000000000b2'::uuid,
      'auth0|same-user',
      NULL
    )
  $$,
  $$VALUES (ARRAY['tenant-b user-1']::text[])$$,
  'same user can access second tenant only when tenant id matches'
);

SELECT results_eq(
  $$
    SELECT array_agg(content ORDER BY content)
    FROM public.search_semantic_memory(
      NULL::public.vector,
      0,
      10,
      'value_proposition',
      NULL,
      NULL,
      NULL,
      '00000000-0000-0000-0000-0000000000a1'::uuid,
      'auth0|other-user',
      NULL
    )
  $$,
  $$VALUES (ARRAY['tenant-a user-2']::text[])$$,
  'same tenant with different user returns only requested auth0_sub rows'
);

SELECT results_eq(
  $$
    SELECT array_agg(content ORDER BY content)
    FROM public.search_semantic_memory(
      NULL::public.vector,
      0,
      10,
      'value_proposition',
      NULL,
      NULL,
      NULL,
      '00000000-0000-0000-0000-0000000000a1'::uuid,
      NULL,
      NULL
    )
  $$,
  $$VALUES (ARRAY['tenant-a user-1','tenant-a user-2']::text[])$$,
  'tenant-only filter includes all users in that tenant'
);

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM public.search_semantic_memory(
      NULL::public.vector,
      0,
      10,
      'value_proposition',
      NULL,
      NULL,
      NULL,
      '00000000-0000-0000-0000-0000000000a1'::uuid,
      'auth0|same-user',
      'session-a'
    )
  $$,
  $$VALUES (1)$$,
  'session_id further narrows retrieval to a single semantic chunk set'
);

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM public.search_semantic_memory(
      NULL::public.vector,
      0,
      10,
      'value_proposition',
      NULL,
      NULL,
      NULL,
      '00000000-0000-0000-0000-0000000000a1'::uuid,
      'auth0|same-user',
      'session-b'
    )
  $$,
  $$VALUES (0)$$,
  'session_id does not leak similarly attributed rows across tenants'
);

SELECT * FROM finish();
ROLLBACK;
