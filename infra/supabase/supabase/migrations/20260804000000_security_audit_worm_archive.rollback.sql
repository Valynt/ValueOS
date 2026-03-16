-- Rollback: 20260804000000_security_audit_worm_archive
-- Drops security audit archive tables.

BEGIN;

DROP TABLE IF EXISTS public.security_audit_archive_alert CASCADE;
DROP TABLE IF EXISTS public.security_audit_archive_segment CASCADE;
DROP TABLE IF EXISTS public.security_audit_archive_batch CASCADE;

COMMIT;
