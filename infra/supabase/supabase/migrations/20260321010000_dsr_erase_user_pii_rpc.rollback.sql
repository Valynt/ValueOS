SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.erase_user_pii(uuid, uuid, timestamptz, text) CASCADE;
DROP TABLE IF EXISTS public.dsr_erasure_requests CASCADE;
