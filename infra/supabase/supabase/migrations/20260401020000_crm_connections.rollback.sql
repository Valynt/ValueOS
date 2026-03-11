-- Rollback: 20260401020000_crm_connections.sql

SET search_path = public, pg_temp;

-- Restore column privilege before dropping (CASCADE handles the table itself)
GRANT SELECT (access_token_enc, refresh_token_enc) ON public.crm_connections TO authenticated;
DROP TABLE IF EXISTS public.crm_connections CASCADE;
