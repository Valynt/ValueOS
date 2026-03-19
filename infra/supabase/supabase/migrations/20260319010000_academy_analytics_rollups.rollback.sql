-- Rollback: academy analytics rollups

SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.refresh_academy_analytics_daily_summary() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.get_academy_simulation_stats(uuid, timestamptz) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_academy_certification_stats(uuid, timestamptz) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_academy_quiz_stats(uuid, timestamptz, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_academy_analytics_org_access(uuid) FROM authenticated;

DROP FUNCTION IF EXISTS public.get_academy_simulation_stats(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.get_academy_certification_stats(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.get_academy_quiz_stats(uuid, timestamptz, integer);
DROP FUNCTION IF EXISTS public.refresh_academy_analytics_daily_summary();
DROP FUNCTION IF EXISTS public.assert_academy_analytics_org_access(uuid);

DROP INDEX IF EXISTS public.idx_academy_analytics_daily_summary_lookup;
DROP MATERIALIZED VIEW IF EXISTS public.academy_analytics_daily_summary;

DROP INDEX IF EXISTS public.idx_certifications_org_awarded_at;
DROP INDEX IF EXISTS public.idx_simulation_attempts_org_completed_at;
DROP INDEX IF EXISTS public.idx_quiz_results_org_pillar_completed_at;
DROP INDEX IF EXISTS public.idx_quiz_results_org_completed_at;
