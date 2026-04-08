-- ============================================================================
-- Rollback: Remove export_jobs and export_job_events tables
-- ============================================================================

BEGIN;

-- Drop view
DROP VIEW IF EXISTS public.export_packages;

-- Drop function
DROP FUNCTION IF EXISTS public.cleanup_expired_export_urls();
DROP FUNCTION IF EXISTS public.validate_artifact_type();

-- Drop tables (cascade to remove triggers and policies)
DROP TABLE IF EXISTS public.export_job_events CASCADE;
DROP TABLE IF EXISTS public.export_jobs CASCADE;

-- Drop trigger function if not used elsewhere (keep if shared)
-- Note: set_updated_at may be used by other tables, so we don't drop it

COMMIT;
