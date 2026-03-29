-- Rollback for S1-2 - Job Idempotency

SET search_path = public, pg_temp;

BEGIN;

-- Drop RPC functions
DROP FUNCTION IF EXISTS public.mark_job_processed(text, text, text, text, text, text, text, text, jsonb, integer);
DROP FUNCTION IF EXISTS public.check_job_idempotency_status(text, text);
DROP FUNCTION IF EXISTS public.cleanup_expired_job_processed();

-- Drop table
DROP TABLE IF EXISTS public.job_processed CASCADE;

COMMIT;
