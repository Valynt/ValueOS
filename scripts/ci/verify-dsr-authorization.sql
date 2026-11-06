-- Negative tests for the SECURITY DEFINER tenant-scoped erasure RPC.
-- Never erase live PII here. All data stays inside a rollback-only transaction.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';

INSERT INTO auth.users (id) VALUES
 ('00000000-0000-4000-8000-000000000441'),
 ('00000000-0000-4000-8000-000000000442');

INSERT INTO public.tenants (id, name) VALUES
 ('dsr-identity-a', 'DSR Test A'),
 ('dsr-identity-b', 'DSR Test B');
INSERT INTO public.organizations (id, tenant_id, name) VALUES
 ('40000000-0000-4000-8000-000000000441', 'dsr-identity-a', 'DSR Org A'),
 ('40000000-0000-4000-8000-000000000442', 'dsr-identity-b', 'DSR Org B');
INSERT INTO public.user_tenants (tenant_id, user_id, role, status) VALUES
 ('dsr-identity-a', '00000000-0000-4000-8000-000000000441', 'owner', 'active'),
 ('dsr-identity-a', '00000000-0000-4000-8000-000000000442', 'member', 'active'),
 ('dsr-identity-b', '00000000-0000-4000-8000-000000000442', 'member', 'active');
INSERT INTO public.users (id, tenant_id, organization_id, email) VALUES
 ('00000000-0000-4000-8000-000000000441', 'dsr-identity-a',
  '40000000-0000-4000-8000-000000000441', 'owner@example.invalid'),
 ('00000000-0000-4000-8000-000000000442', 'dsr-identity-a',
  '40000000-0000-4000-8000-000000000441', 'member@example.invalid');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000442';
DO $member_denied$
BEGIN
  BEGIN
    PERFORM public.erase_user_pii('dsr-identity-a',
      '00000000-0000-4000-8000-000000000441', now(),
      'negative-member-erase', NULL);
    RAISE EXCEPTION 'Ordinary tenant member was able to invoke privileged DSR erase';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $member_denied$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000441';
DO $multi_tenant_denied$
BEGIN
  BEGIN
    PERFORM public.erase_user_pii('dsr-identity-a',
      '00000000-0000-4000-8000-000000000442', now(),
      'negative-multitenant-erase', NULL);
    RAISE EXCEPTION 'Tenant admin erased a globally shared multi-tenant identity';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM public.dsr_erasure_requests
    WHERE request_token IN ('negative-member-erase','negative-multitenant-erase')
  ) THEN
    RAISE EXCEPTION 'Rejected erasure wrote a DSR ledger record';
  END IF;
END $multi_tenant_denied$;
ROLLBACK;
