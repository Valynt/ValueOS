-- Rollback for Tenant-Safe Secret Layer

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.secret_access_audits CASCADE;
DROP TABLE IF EXISTS public.tenant_secrets CASCADE;

COMMIT;
