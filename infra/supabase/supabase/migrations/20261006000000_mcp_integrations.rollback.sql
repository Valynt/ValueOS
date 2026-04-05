SET search_path = public, pg_temp;

BEGIN;

DROP TABLE IF EXISTS public.tenant_mcp_integration_failures;
DROP TABLE IF EXISTS public.tenant_mcp_integration_audit_events;
DROP TABLE IF EXISTS public.tenant_mcp_integrations;

COMMIT;
