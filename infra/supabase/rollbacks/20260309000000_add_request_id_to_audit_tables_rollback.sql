-- Rollback: 20260309000000_add_request_id_to_audit_tables
-- Removes request_id columns and their indexes from audit tables.
SET search_path = public, pg_temp;

DROP INDEX IF EXISTS public.idx_audit_logs_request_id;
ALTER TABLE public.audit_logs DROP COLUMN IF EXISTS request_id;

DROP INDEX IF EXISTS public.idx_agent_audit_log_request_id;
ALTER TABLE public.agent_audit_log DROP COLUMN IF EXISTS request_id;
