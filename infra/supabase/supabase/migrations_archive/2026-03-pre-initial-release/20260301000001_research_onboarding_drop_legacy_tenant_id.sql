-- ============================================================================
-- 20260301000001_research_onboarding_drop_legacy_tenant_id.sql
-- Deprecation cleanup: remove legacy TEXT tenant_id columns after UUID cutover.
-- ============================================================================

ALTER TABLE IF EXISTS public.company_research_jobs
  DROP COLUMN IF EXISTS tenant_id_legacy;

ALTER TABLE IF EXISTS public.company_research_suggestions
  DROP COLUMN IF EXISTS tenant_id_legacy;
