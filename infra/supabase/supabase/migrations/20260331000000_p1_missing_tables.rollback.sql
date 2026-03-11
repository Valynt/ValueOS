-- Rollback: 20260331000000_p1_missing_tables.sql

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.agent_audit_logs CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
