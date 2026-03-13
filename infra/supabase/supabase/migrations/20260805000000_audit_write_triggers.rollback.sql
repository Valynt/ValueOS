DROP TRIGGER IF EXISTS memberships_sensitive_write_audit ON public.memberships;
DROP TRIGGER IF EXISTS value_cases_sensitive_write_audit ON public.value_cases;
DROP FUNCTION IF EXISTS public.capture_sensitive_write_audit();
