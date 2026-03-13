-- Rollback: 20260327000000_pending_subscription_changes.sql
-- Drops the pending_subscription_changes table.

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.pending_subscription_changes CASCADE;
