-- Academy analytics rollups
--
-- Replaces row-heavy academy analytics reductions in Node with SQL-side
-- aggregation. Adds a daily materialized summary keyed by organization and
-- time bucket, RPCs that preserve the endpoint response contracts, and
-- composite indexes for the hot organization/date access paths.

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- Hot-path indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_quiz_results_org_completed_at
  ON public.quiz_results (organization_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_results_org_pillar_completed_at
  ON public.quiz_results (organization_id, pillar_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulation_attempts_org_completed_at
  ON public.simulation_attempts (organization_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_certifications_org_awarded_at
  ON public.certifications (organization_id, awarded_at DESC);

-- ---------------------------------------------------------------------------
-- Pre-aggregated daily summary path
-- ---------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.academy_analytics_daily_summary;

CREATE MATERIALIZED VIEW public.academy_analytics_daily_summary AS
WITH quiz_overall AS (
  SELECT
    qr.organization_id,
    (qr.completed_at AT TIME ZONE 'UTC')::date AS bucket_date,
    'quiz'::text AS metric_type,
    'all'::text AS dimension_type,
    NULL::text AS dimension_key,
    COUNT(*)::bigint AS total_count,
    COUNT(*) FILTER (WHERE qr.passed IS TRUE)::bigint AS passed_count,
    COUNT(DISTINCT qr.user_id)::bigint AS distinct_users,
    COALESCE(SUM(qr.score), 0)::numeric AS score_sum,
    COUNT(qr.score)::bigint AS score_count
  FROM public.quiz_results qr
  GROUP BY qr.organization_id, (qr.completed_at AT TIME ZONE 'UTC')::date
),
quiz_by_pillar AS (
  SELECT
    qr.organization_id,
    (qr.completed_at AT TIME ZONE 'UTC')::date AS bucket_date,
    'quiz'::text AS metric_type,
    'pillar'::text AS dimension_type,
    qr.pillar_id::text AS dimension_key,
    COUNT(*)::bigint AS total_count,
    COUNT(*) FILTER (WHERE qr.passed IS TRUE)::bigint AS passed_count,
    COUNT(DISTINCT qr.user_id)::bigint AS distinct_users,
    COALESCE(SUM(qr.score), 0)::numeric AS score_sum,
    COUNT(qr.score)::bigint AS score_count
  FROM public.quiz_results qr
  GROUP BY qr.organization_id, (qr.completed_at AT TIME ZONE 'UTC')::date, qr.pillar_id
),
certification_overall AS (
  SELECT
    c.organization_id,
    (c.awarded_at AT TIME ZONE 'UTC')::date AS bucket_date,
    'certification'::text AS metric_type,
    'all'::text AS dimension_type,
    NULL::text AS dimension_key,
    COUNT(*)::bigint AS total_count,
    0::bigint AS passed_count,
    COUNT(DISTINCT c.user_id)::bigint AS distinct_users,
    COALESCE(SUM(c.score), 0)::numeric AS score_sum,
    COUNT(c.score)::bigint AS score_count
  FROM public.certifications c
  GROUP BY c.organization_id, (c.awarded_at AT TIME ZONE 'UTC')::date
),
certification_by_tier AS (
  SELECT
    c.organization_id,
    (c.awarded_at AT TIME ZONE 'UTC')::date AS bucket_date,
    'certification'::text AS metric_type,
    'tier'::text AS dimension_type,
    COALESCE(c.tier, 'bronze')::text AS dimension_key,
    COUNT(*)::bigint AS total_count,
    0::bigint AS passed_count,
    COUNT(DISTINCT c.user_id)::bigint AS distinct_users,
    COALESCE(SUM(c.score), 0)::numeric AS score_sum,
    COUNT(c.score)::bigint AS score_count
  FROM public.certifications c
  GROUP BY c.organization_id, (c.awarded_at AT TIME ZONE 'UTC')::date, COALESCE(c.tier, 'bronze')
),
simulation_overall AS (
  SELECT
    sa.organization_id,
    (sa.completed_at AT TIME ZONE 'UTC')::date AS bucket_date,
    'simulation'::text AS metric_type,
    'all'::text AS dimension_type,
    NULL::text AS dimension_key,
    COUNT(*)::bigint AS total_count,
    COUNT(*) FILTER (WHERE sa.passed IS TRUE)::bigint AS passed_count,
    COUNT(DISTINCT sa.user_id)::bigint AS distinct_users,
    COALESCE(SUM(sa.overall_score), 0)::numeric AS score_sum,
    COUNT(sa.overall_score)::bigint AS score_count
  FROM public.simulation_attempts sa
  GROUP BY sa.organization_id, (sa.completed_at AT TIME ZONE 'UTC')::date
)
SELECT * FROM quiz_overall
UNION ALL
SELECT * FROM quiz_by_pillar
UNION ALL
SELECT * FROM certification_overall
UNION ALL
SELECT * FROM certification_by_tier
UNION ALL
SELECT * FROM simulation_overall;

CREATE INDEX IF NOT EXISTS idx_academy_analytics_daily_summary_lookup
  ON public.academy_analytics_daily_summary (
    organization_id,
    metric_type,
    bucket_date,
    dimension_type,
    dimension_key
  );

-- ---------------------------------------------------------------------------
-- Access helper + refresh path
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_academy_analytics_org_access(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_tenants ut
    WHERE ut.user_id = (auth.uid())::text
      AND ut.tenant_id = p_organization_id::text
      AND COALESCE(ut.status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'Tenant access denied for organization %', p_organization_id
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_academy_analytics_daily_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.academy_analytics_daily_summary;
END;
$$;

-- ---------------------------------------------------------------------------
-- Analytics RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_academy_quiz_stats(
  p_organization_id uuid,
  p_cutoff timestamptz DEFAULT NULL,
  p_pillar_id integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_users bigint := 0;
  v_total_quizzes bigint := 0;
  v_passed_count bigint := 0;
  v_score_sum numeric := 0;
  v_score_count bigint := 0;
  v_distinct_quiz_users bigint := 0;
  v_pillar_breakdown jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.assert_academy_analytics_org_access(p_organization_id);

  SELECT COUNT(DISTINCT ut.user_id)::bigint
  INTO v_total_users
  FROM public.user_tenants ut
  WHERE ut.tenant_id = p_organization_id::text
    AND COALESCE(ut.status, 'active') = 'active';

  WITH summary_filtered AS (
    SELECT
      COALESCE(SUM(s.total_count), 0)::bigint AS total_quizzes,
      COALESCE(SUM(s.passed_count), 0)::bigint AS passed_count
    FROM public.academy_analytics_daily_summary s
    WHERE s.organization_id = p_organization_id
      AND s.metric_type = 'quiz'
      AND s.dimension_type = 'all'
      AND s.bucket_date < (now() AT TIME ZONE 'UTC')::date
      AND (p_cutoff IS NULL OR s.bucket_date >= (p_cutoff AT TIME ZONE 'UTC')::date)
  ),
  live_filtered AS (
    SELECT
      COUNT(*)::bigint AS total_quizzes,
      COUNT(*) FILTER (WHERE qr.passed IS TRUE)::bigint AS passed_count
    FROM public.quiz_results qr
    WHERE qr.organization_id = p_organization_id
      AND qr.completed_at >= timezone('UTC', date_trunc('day', timezone('UTC', now())))
      AND (p_cutoff IS NULL OR qr.completed_at >= p_cutoff)
      AND (p_pillar_id IS NULL OR qr.pillar_id = p_pillar_id)
  )
  SELECT
    summary_filtered.total_quizzes + live_filtered.total_quizzes,
    summary_filtered.passed_count + live_filtered.passed_count
  INTO v_total_quizzes, v_passed_count
  FROM summary_filtered, live_filtered;

  IF p_pillar_id IS NOT NULL THEN
    WITH summary_filtered AS (
      SELECT
        COALESCE(SUM(s.total_count), 0)::bigint AS total_quizzes,
        COALESCE(SUM(s.passed_count), 0)::bigint AS passed_count
      FROM public.academy_analytics_daily_summary s
      WHERE s.organization_id = p_organization_id
        AND s.metric_type = 'quiz'
        AND s.dimension_type = 'pillar'
        AND s.dimension_key = p_pillar_id::text
        AND s.bucket_date < (now() AT TIME ZONE 'UTC')::date
        AND (p_cutoff IS NULL OR s.bucket_date >= (p_cutoff AT TIME ZONE 'UTC')::date)
    ),
    live_filtered AS (
      SELECT
        COUNT(*)::bigint AS total_quizzes,
        COUNT(*) FILTER (WHERE qr.passed IS TRUE)::bigint AS passed_count
      FROM public.quiz_results qr
      WHERE qr.organization_id = p_organization_id
        AND qr.pillar_id = p_pillar_id
        AND qr.completed_at >= timezone('UTC', date_trunc('day', timezone('UTC', now())))
        AND (p_cutoff IS NULL OR qr.completed_at >= p_cutoff)
    )
    SELECT
      summary_filtered.total_quizzes + live_filtered.total_quizzes,
      summary_filtered.passed_count + live_filtered.passed_count
    INTO v_total_quizzes, v_passed_count
    FROM summary_filtered, live_filtered;
  END IF;

  WITH summary_scores AS (
    SELECT
      COALESCE(SUM(s.score_sum), 0)::numeric AS score_sum,
      COALESCE(SUM(s.score_count), 0)::bigint AS score_count
    FROM public.academy_analytics_daily_summary s
    WHERE s.organization_id = p_organization_id
      AND s.metric_type = 'quiz'
      AND (
        (p_pillar_id IS NULL AND s.dimension_type = 'all') OR
        (p_pillar_id IS NOT NULL AND s.dimension_type = 'pillar' AND s.dimension_key = p_pillar_id::text)
      )
      AND s.bucket_date < (now() AT TIME ZONE 'UTC')::date
  ),
  live_scores AS (
    SELECT
      COALESCE(SUM(qr.score), 0)::numeric AS score_sum,
      COUNT(qr.score)::bigint AS score_count
    FROM public.quiz_results qr
    WHERE qr.organization_id = p_organization_id
      AND qr.completed_at >= timezone('UTC', date_trunc('day', timezone('UTC', now())))
      AND (p_pillar_id IS NULL OR qr.pillar_id = p_pillar_id)
  )
  SELECT
    summary_scores.score_sum + live_scores.score_sum,
    summary_scores.score_count + live_scores.score_count
  INTO v_score_sum, v_score_count
  FROM summary_scores, live_scores;

  SELECT COUNT(DISTINCT qr.user_id)::bigint
  INTO v_distinct_quiz_users
  FROM public.quiz_results qr
  WHERE qr.organization_id = p_organization_id
    AND (p_pillar_id IS NULL OR qr.pillar_id = p_pillar_id);

  WITH summarized_breakdown AS (
    SELECT
      s.dimension_key::integer AS pillar_id,
      SUM(s.total_count)::bigint AS attempts,
      SUM(s.passed_count)::bigint AS passed_count,
      SUM(s.score_sum)::numeric AS score_sum,
      SUM(s.score_count)::bigint AS score_count
    FROM public.academy_analytics_daily_summary s
    WHERE s.organization_id = p_organization_id
      AND s.metric_type = 'quiz'
      AND s.dimension_type = 'pillar'
      AND s.bucket_date < (now() AT TIME ZONE 'UTC')::date
      AND (p_pillar_id IS NULL OR s.dimension_key = p_pillar_id::text)
    GROUP BY s.dimension_key
  ),
  live_breakdown AS (
    SELECT
      qr.pillar_id,
      COUNT(*)::bigint AS attempts,
      COUNT(*) FILTER (WHERE qr.passed IS TRUE)::bigint AS passed_count,
      COALESCE(SUM(qr.score), 0)::numeric AS score_sum,
      COUNT(qr.score)::bigint AS score_count
    FROM public.quiz_results qr
    WHERE qr.organization_id = p_organization_id
      AND qr.completed_at >= timezone('UTC', date_trunc('day', timezone('UTC', now())))
      AND (p_pillar_id IS NULL OR qr.pillar_id = p_pillar_id)
    GROUP BY qr.pillar_id
  ),
  pillar_totals AS (
    SELECT
      pillar_id,
      SUM(attempts)::bigint AS attempts,
      SUM(passed_count)::bigint AS passed_count,
      SUM(score_sum)::numeric AS score_sum,
      SUM(score_count)::bigint AS score_count
    FROM (
      SELECT * FROM summarized_breakdown
      UNION ALL
      SELECT * FROM live_breakdown
    ) breakdown
    GROUP BY pillar_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'pillarId', pt.pillar_id,
        'pillarName', COALESCE(ap.title, 'Pillar ' || pt.pillar_id::text),
        'attempts', pt.attempts,
        'averageScore', CASE WHEN pt.score_count > 0 THEN ROUND(pt.score_sum / pt.score_count)::integer ELSE 0 END,
        'passRate', CASE WHEN pt.attempts > 0 THEN ROUND((pt.passed_count::numeric * 100) / pt.attempts)::integer ELSE 0 END
      )
      ORDER BY pt.pillar_id
    ),
    '[]'::jsonb
  )
  INTO v_pillar_breakdown
  FROM pillar_totals pt
  LEFT JOIN public.academy_pillars ap
    ON ap.id = pt.pillar_id;

  RETURN jsonb_build_object(
    'totalQuizzes', v_total_quizzes,
    'averageScore', CASE WHEN v_score_count > 0 THEN ROUND(v_score_sum / v_score_count)::integer ELSE 0 END,
    'passRate', CASE WHEN v_total_quizzes > 0 THEN ROUND((v_passed_count::numeric * 100) / v_total_quizzes)::integer ELSE 0 END,
    'completionRate', CASE WHEN v_total_users > 0 THEN ROUND((v_distinct_quiz_users::numeric * 100) / v_total_users)::integer ELSE 0 END,
    'pillarBreakdown', v_pillar_breakdown
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_academy_certification_stats(
  p_organization_id uuid,
  p_cutoff timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_certifications bigint := 0;
  v_tier_breakdown jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.assert_academy_analytics_org_access(p_organization_id);

  WITH summary_filtered AS (
    SELECT COALESCE(SUM(s.total_count), 0)::bigint AS total_certifications
    FROM public.academy_analytics_daily_summary s
    WHERE s.organization_id = p_organization_id
      AND s.metric_type = 'certification'
      AND s.dimension_type = 'all'
      AND s.bucket_date < (now() AT TIME ZONE 'UTC')::date
      AND (p_cutoff IS NULL OR s.bucket_date >= (p_cutoff AT TIME ZONE 'UTC')::date)
  ),
  live_filtered AS (
    SELECT COUNT(*)::bigint AS total_certifications
    FROM public.certifications c
    WHERE c.organization_id = p_organization_id
      AND c.awarded_at >= timezone('UTC', date_trunc('day', timezone('UTC', now())))
      AND (p_cutoff IS NULL OR c.awarded_at >= p_cutoff)
  )
  SELECT summary_filtered.total_certifications + live_filtered.total_certifications
  INTO v_total_certifications
  FROM summary_filtered, live_filtered;

  WITH summarized_tiers AS (
    SELECT
      s.dimension_key AS tier,
      SUM(s.total_count)::bigint AS total_count
    FROM public.academy_analytics_daily_summary s
    WHERE s.organization_id = p_organization_id
      AND s.metric_type = 'certification'
      AND s.dimension_type = 'tier'
      AND s.bucket_date < (now() AT TIME ZONE 'UTC')::date
    GROUP BY s.dimension_key
  ),
  live_tiers AS (
    SELECT
      COALESCE(c.tier, 'bronze') AS tier,
      COUNT(*)::bigint AS total_count
    FROM public.certifications c
    WHERE c.organization_id = p_organization_id
      AND c.awarded_at >= timezone('UTC', date_trunc('day', timezone('UTC', now())))
    GROUP BY COALESCE(c.tier, 'bronze')
  ),
  tier_totals AS (
    SELECT tier, SUM(total_count)::bigint AS total_count
    FROM (
      SELECT * FROM summarized_tiers
      UNION ALL
      SELECT * FROM live_tiers
    ) tiers
    GROUP BY tier
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'tier', tier_totals.tier,
        'count', tier_totals.total_count
      )
      ORDER BY tier_totals.tier
    ),
    '[]'::jsonb
  )
  INTO v_tier_breakdown
  FROM tier_totals;

  RETURN jsonb_build_object(
    'totalCertifications', v_total_certifications,
    'tierBreakdown', v_tier_breakdown
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_academy_simulation_stats(
  p_organization_id uuid,
  p_cutoff timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_attempts bigint := 0;
  v_passed_count bigint := 0;
  v_score_sum numeric := 0;
  v_score_count bigint := 0;
BEGIN
  PERFORM public.assert_academy_analytics_org_access(p_organization_id);

  WITH summary_filtered AS (
    SELECT COALESCE(SUM(s.total_count), 0)::bigint AS total_attempts
    FROM public.academy_analytics_daily_summary s
    WHERE s.organization_id = p_organization_id
      AND s.metric_type = 'simulation'
      AND s.dimension_type = 'all'
      AND s.bucket_date < (now() AT TIME ZONE 'UTC')::date
      AND (p_cutoff IS NULL OR s.bucket_date >= (p_cutoff AT TIME ZONE 'UTC')::date)
  ),
  live_filtered AS (
    SELECT COUNT(*)::bigint AS total_attempts
    FROM public.simulation_attempts sa
    WHERE sa.organization_id = p_organization_id
      AND sa.completed_at >= timezone('UTC', date_trunc('day', timezone('UTC', now())))
      AND (p_cutoff IS NULL OR sa.completed_at >= p_cutoff)
  )
  SELECT summary_filtered.total_attempts + live_filtered.total_attempts
  INTO v_total_attempts
  FROM summary_filtered, live_filtered;

  WITH summary_scores AS (
    SELECT
      COALESCE(SUM(s.score_sum), 0)::numeric AS score_sum,
      COALESCE(SUM(s.score_count), 0)::bigint AS score_count,
      COALESCE(SUM(s.passed_count), 0)::bigint AS passed_count
    FROM public.academy_analytics_daily_summary s
    WHERE s.organization_id = p_organization_id
      AND s.metric_type = 'simulation'
      AND s.dimension_type = 'all'
      AND s.bucket_date < (now() AT TIME ZONE 'UTC')::date
  ),
  live_scores AS (
    SELECT
      COALESCE(SUM(sa.overall_score), 0)::numeric AS score_sum,
      COUNT(sa.overall_score)::bigint AS score_count,
      COUNT(*) FILTER (WHERE sa.passed IS TRUE)::bigint AS passed_count
    FROM public.simulation_attempts sa
    WHERE sa.organization_id = p_organization_id
      AND sa.completed_at >= timezone('UTC', date_trunc('day', timezone('UTC', now())))
  )
  SELECT
    summary_scores.score_sum + live_scores.score_sum,
    summary_scores.score_count + live_scores.score_count,
    summary_scores.passed_count + live_scores.passed_count
  INTO v_score_sum, v_score_count, v_passed_count
  FROM summary_scores, live_scores;

  RETURN jsonb_build_object(
    'totalAttempts', v_total_attempts,
    'averageScore', CASE WHEN v_score_count > 0 THEN ROUND(v_score_sum / v_score_count)::integer ELSE 0 END,
    'passRate', CASE WHEN v_total_attempts > 0 THEN ROUND((v_passed_count::numeric * 100) / v_total_attempts)::integer ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_academy_analytics_org_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_academy_quiz_stats(uuid, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_academy_certification_stats(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_academy_simulation_stats(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_academy_analytics_daily_summary() TO service_role;
