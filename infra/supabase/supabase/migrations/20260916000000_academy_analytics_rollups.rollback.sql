DROP FUNCTION IF EXISTS public.refresh_academy_analytics_daily_summary(uuid, date, date);
DROP FUNCTION IF EXISTS public.get_academy_simulation_stats(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.get_academy_certification_stats(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.get_academy_quiz_stats(uuid, timestamptz, integer);

DROP POLICY IF EXISTS academy_analytics_daily_summary_service_role ON public.academy_analytics_daily_summary;
DROP POLICY IF EXISTS academy_analytics_daily_summary_select ON public.academy_analytics_daily_summary;
DROP TABLE IF EXISTS public.academy_analytics_daily_summary;

DROP INDEX IF EXISTS public.idx_users_org_last_signed_in;
DROP INDEX IF EXISTS public.idx_users_org_id;
DROP INDEX IF EXISTS public.idx_certifications_user_awarded_at;
DROP INDEX IF EXISTS public.idx_simulation_attempts_org_completed_at;
DROP INDEX IF EXISTS public.idx_quiz_results_org_pillar_completed_at;
DROP INDEX IF EXISTS public.idx_quiz_results_org_completed_at;
