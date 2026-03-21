REVOKE EXECUTE ON FUNCTION public.erase_user_pii(text, uuid, timestamptz, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.erase_user_pii(text, uuid, timestamptz, text, text) FROM service_role;
DROP FUNCTION IF EXISTS public.erase_user_pii(text, uuid, timestamptz, text, text);

DROP POLICY IF EXISTS dsr_erasure_requests_service_role ON public.dsr_erasure_requests;
DROP POLICY IF EXISTS dsr_erasure_requests_tenant_select ON public.dsr_erasure_requests;
DROP TABLE IF EXISTS public.dsr_erasure_requests;
