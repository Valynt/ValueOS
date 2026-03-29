-- Rollback for S1-1 - DEFINER Function Audit

SET search_path = public, security, pg_temp;

BEGIN;

-- Drop RPC function
DROP FUNCTION IF EXISTS public.get_definer_function_compliance_status();

-- Drop check functions
DROP FUNCTION IF EXISTS security.check_unverified_definer_functions();
DROP FUNCTION IF EXISTS security.audit_all_definer_functions();
DROP FUNCTION IF EXISTS security.check_definer_has_tenant_verification(oid);
DROP FUNCTION IF EXISTS security.get_all_definer_functions();

-- Drop audit table and all its data
DROP TABLE IF EXISTS security.definer_function_audit CASCADE;

COMMIT;
