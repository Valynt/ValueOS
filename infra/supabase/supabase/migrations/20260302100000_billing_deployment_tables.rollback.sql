-- Rollback: 20260302100000_billing_deployment_tables
-- Drops approval_requests, approval_attachments, feature_flags, feature_flag_evaluations.

BEGIN;

DROP TABLE IF EXISTS public.feature_flag_evaluations CASCADE;
DROP TABLE IF EXISTS public.feature_flags CASCADE;
DROP TABLE IF EXISTS public.approval_attachments CASCADE;
DROP TABLE IF EXISTS public.approval_requests CASCADE;

COMMIT;
