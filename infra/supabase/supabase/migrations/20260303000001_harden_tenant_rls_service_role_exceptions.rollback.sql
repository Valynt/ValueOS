-- Rollback: 20260303000001_harden_tenant_rls_service_role_exceptions
-- Removes RLS policies added by this migration.
-- Note: does not disable RLS on user_profile_directory — that would be a security regression.

BEGIN;

DROP POLICY IF EXISTS provenance_records_tenant_scoped ON public.provenance_records;
DROP POLICY IF EXISTS evidence_items_tenant_scoped ON public.evidence_items;
DROP POLICY IF EXISTS saga_transitions_tenant_scoped ON public.saga_transitions;
DROP POLICY IF EXISTS user_profile_directory_service_role_access ON public.user_profile_directory;
DROP POLICY IF EXISTS user_profile_directory_tenant_select ON public.user_profile_directory;

COMMIT;
