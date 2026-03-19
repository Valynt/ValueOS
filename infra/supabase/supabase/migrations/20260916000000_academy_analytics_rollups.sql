-- Migration: academy analytics SQL rollups
--
-- Replaces academy analytics dashboard row-by-row reductions with SQL-side
-- aggregates and introduces a daily organization summary table that can be
-- refreshed by background jobs for heavier dashboard workloads.

CREATE INDEX IF NOT EXISTS idx_quiz_results_org_completed_at
  ON public.quiz_results (organization_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_results_org_pillar_completed_at
  ON public.quiz_results (organization_id, pillar_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulation_attempts_org_completed_at
  ON public.simulation_attempts (organization_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_certifications_user_awarded_at
  ON public.certifications (user_id, awarded_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_org_id
  ON public.users (organization_id, id);

CREATE INDEX IF NOT EXISTS idx_users_org_last_signed_in
  ON public.users (organization_id, last_signed_in DESC);

CREATE TABLE IF NOT EXISTS public.academy_analytics_daily_summary (
  organization_id uuid NOT NULL,
  bucket_date date NOT NULL,
  quiz_attempts integer NOT NULL DEFAULT 0,
  quiz_passed integer NOT NULL DEFAULT 0,
  quiz_score_total bigint NOT NULL DEFAULT 0,
  quiz_distinct_users integer NOT NULL DEFAULT 0,
  simulation_attempts integer NOT NULL DEFAULT 0,
  simulation_passed integer NOT NULL DEFAULT 0,
  simulation_score_total bigint NOT NULL DEFAULT 0,
  certifications_awarded integer NOT NULL DEFAULT 0,
  quiz_pillar_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  certification_tier_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, bucket_date)
);

ALTER TABLE public.academy_analytics_daily_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS academy_analytics_daily_summary_select ON public.academy_analytics_daily_summary;
CREATE POLICY academy_analytics_daily_summary_select
  ON public.academy_analytics_daily_summary
  FOR SELECT
  TO authenticated
  USING (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS academy_analytics_daily_summary_service_role ON public.academy_analytics_daily_summary;
CREATE POLICY academy_analytics_daily_summary_service_role
  ON public.academy_analytics_daily_summary
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_academy_quiz_stats(
  p_organization_id uuid,
  p_since timestamptz DEFAULT NULL,
  p_pillar_id integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_organization_id IS NULL OR NOT security.user_has_tenant_access(p_organization_id) THEN
    RAISE EXCEPTION 'academy quiz stats access denied for organization %', p_organization_id
      USING ERRCODE = '42501';
  END IF;

  WITH filtered_results AS (
    SELECT qr.user_id, qr.pillar_id, qr.score, qr.passed
    FROM public.quiz_results AS qr
    WHERE qr.organization_id = p_organization_id
      AND (p_since IS NULL OR qr.completed_at >= p_since)
      AND (p_pillar_id IS NULL OR qr.pillar_id = p_pillar_id)
  ),
  totals AS (
    SELECT
      COUNT(*)::integer AS total_quizzes,
      COALESCE(ROUND(AVG(fr.score))::integer, 0) AS average_score,
      COALESCE(ROUND(AVG(CASE WHEN fr.passed THEN 100.0 ELSE 0.0 END))::integer, 0) AS pass_rate,
      COUNT(DISTINCT fr.user_id)::integer AS distinct_quiz_users
    FROM filtered_results AS fr
  ),
  users_in_org AS (
    SELECT COUNT(*)::integer AS total_users
    FROM public.users AS u
    WHERE u.organization_id = p_organization_id
  ),
  pillar_stats AS (
    SELECT
      fr.pillar_id,
      COALESCE(p.title, 'Pillar ' || fr.pillar_id::text) AS pillar_name,
      COUNT(*)::integer AS attempts,
      COALESCE(ROUND(AVG(fr.score))::integer, 0) AS average_score,
      COALESCE(ROUND(AVG(CASE WHEN fr.passed THEN 100.0 ELSE 0.0 END))::integer, 0) AS pass_rate
    FROM filtered_results AS fr
    LEFT JOIN public.pillars AS p
      ON p.id = fr.pillar_id
    GROUP BY fr.pillar_id, COALESCE(p.title, 'Pillar ' || fr.pillar_id::text)
    ORDER BY fr.pillar_id
  )
  SELECT jsonb_build_object(
    'totalQuizzes', totals.total_quizzes,
    'averageScore', totals.average_score,
    'passRate', totals.pass_rate,
    'completionRate', CASE
      WHEN users_in_org.total_users > 0
        THEN ROUND((totals.distinct_quiz_users::numeric * 100.0) / users_in_org.total_users)::integer
      ELSE 0
    END,
    'pillarBreakdown', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'pillarId', ps.pillar_id,
            'pillarName', ps.pillar_name,
            'attempts', ps.attempts,
            'averageScore', ps.average_score,
            'passRate', ps.pass_rate
          )
          ORDER BY ps.pillar_id
        )
        FROM pillar_stats AS ps
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM totals
  CROSS JOIN users_in_org;

  RETURN COALESCE(
    v_result,
    jsonb_build_object(
      'totalQuizzes', 0,
      'averageScore', 0,
      'passRate', 0,
      'completionRate', 0,
      'pillarBreakdown', '[]'::jsonb
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_academy_certification_stats(
  p_organization_id uuid,
  p_since timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_organization_id IS NULL OR NOT security.user_has_tenant_access(p_organization_id) THEN
    RAISE EXCEPTION 'academy certification stats access denied for organization %', p_organization_id
      USING ERRCODE = '42501';
  END IF;

  WITH filtered_certifications AS (
    SELECT c.tier
    FROM public.certifications AS c
    INNER JOIN public.users AS u
      ON u.id::text = c.user_id
    WHERE u.organization_id = p_organization_id
      AND (p_since IS NULL OR c.awarded_at >= p_since)
  ),
  totals AS (
    SELECT COUNT(*)::integer AS total_certifications
    FROM filtered_certifications
  ),
  tier_stats AS (
    SELECT
      COALESCE(fc.tier, 'bronze') AS tier,
      COUNT(*)::integer AS count
    FROM filtered_certifications AS fc
    GROUP BY COALESCE(fc.tier, 'bronze')
    ORDER BY COALESCE(fc.tier, 'bronze')
  )
  SELECT jsonb_build_object(
    'totalCertifications', totals.total_certifications,
    'tierBreakdown', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'tier', ts.tier,
            'count', ts.count
          )
          ORDER BY ts.tier
        )
        FROM tier_stats AS ts
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM totals;

  RETURN COALESCE(
    v_result,
    jsonb_build_object(
      'totalCertifications', 0,
      'tierBreakdown', '[]'::jsonb
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_academy_simulation_stats(
  p_organization_id uuid,
  p_since timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_organization_id IS NULL OR NOT security.user_has_tenant_access(p_organization_id) THEN
    RAISE EXCEPTION 'academy simulation stats access denied for organization %', p_organization_id
      USING ERRCODE = '42501';
  END IF;

  WITH filtered_attempts AS (
    SELECT sa.overall_score, sa.passed
    FROM public.simulation_attempts AS sa
    WHERE sa.organization_id = p_organization_id
      AND (p_since IS NULL OR sa.completed_at >= p_since)
  )
  SELECT jsonb_build_object(
    'totalAttempts', COUNT(*)::integer,
    'averageScore', COALESCE(ROUND(AVG(fa.overall_score))::integer, 0),
    'passRate', COALESCE(ROUND(AVG(CASE WHEN fa.passed THEN 100.0 ELSE 0.0 END))::integer, 0)
  )
  INTO v_result
  FROM filtered_attempts AS fa;

  RETURN COALESCE(
    v_result,
    jsonb_build_object(
      'totalAttempts', 0,
      'averageScore', 0,
      'passRate', 0
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_academy_analytics_daily_summary(
  p_organization_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_start_date date := COALESCE(p_start_date, CURRENT_DATE - 90);
  v_end_date date := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'p_organization_id is required';
  END IF;

  IF v_end_date < v_start_date THEN
    RAISE EXCEPTION 'p_end_date (%) must be on or after p_start_date (%)', v_end_date, v_start_date;
  END IF;

  DELETE FROM public.academy_analytics_daily_summary AS summary
  WHERE summary.organization_id = p_organization_id
    AND summary.bucket_date BETWEEN v_start_date AND v_end_date;

  WITH date_buckets AS (
    SELECT generate_series(v_start_date, v_end_date, interval '1 day')::date AS bucket_date
  ),
  quiz_daily AS (
    SELECT
      qr.completed_at::date AS bucket_date,
      COUNT(*)::integer AS attempts,
      COUNT(*) FILTER (WHERE qr.passed)::integer AS passed,
      COALESCE(SUM(qr.score), 0)::bigint AS score_total,
      COUNT(DISTINCT qr.user_id)::integer AS distinct_users
    FROM public.quiz_results AS qr
    WHERE qr.organization_id = p_organization_id
      AND qr.completed_at::date BETWEEN v_start_date AND v_end_date
    GROUP BY qr.completed_at::date
  ),
  quiz_pillar_daily AS (
    SELECT
      qr.completed_at::date AS bucket_date,
      jsonb_agg(
        jsonb_build_object(
          'pillarId', bucketed.pillar_id,
          'attempts', bucketed.attempts,
          'averageScore', bucketed.average_score,
          'passRate', bucketed.pass_rate
        )
        ORDER BY bucketed.pillar_id
      ) AS pillar_breakdown
    FROM (
      SELECT
        qr.completed_at::date AS bucket_date,
        qr.pillar_id,
        COUNT(*)::integer AS attempts,
        COALESCE(ROUND(AVG(qr.score))::integer, 0) AS average_score,
        COALESCE(ROUND(AVG(CASE WHEN qr.passed THEN 100.0 ELSE 0.0 END))::integer, 0) AS pass_rate
      FROM public.quiz_results AS qr
      WHERE qr.organization_id = p_organization_id
        AND qr.completed_at::date BETWEEN v_start_date AND v_end_date
      GROUP BY qr.completed_at::date, qr.pillar_id
    ) AS bucketed
    GROUP BY bucketed.bucket_date
  ),
  simulation_daily AS (
    SELECT
      sa.completed_at::date AS bucket_date,
      COUNT(*)::integer AS attempts,
      COUNT(*) FILTER (WHERE sa.passed)::integer AS passed,
      COALESCE(SUM(sa.overall_score), 0)::bigint AS score_total
    FROM public.simulation_attempts AS sa
    WHERE sa.organization_id = p_organization_id
      AND sa.completed_at::date BETWEEN v_start_date AND v_end_date
    GROUP BY sa.completed_at::date
  ),
  certification_daily AS (
    SELECT
      c.awarded_at::date AS bucket_date,
      COUNT(*)::integer AS certifications_awarded
    FROM public.certifications AS c
    INNER JOIN public.users AS u
      ON u.id::text = c.user_id
    WHERE u.organization_id = p_organization_id
      AND c.awarded_at::date BETWEEN v_start_date AND v_end_date
    GROUP BY c.awarded_at::date
  ),
  certification_tier_daily AS (
    SELECT
      bucketed.bucket_date,
      jsonb_agg(
        jsonb_build_object(
          'tier', bucketed.tier,
          'count', bucketed.count
        )
        ORDER BY bucketed.tier
      ) AS tier_breakdown
    FROM (
      SELECT
        c.awarded_at::date AS bucket_date,
        COALESCE(c.tier, 'bronze') AS tier,
        COUNT(*)::integer AS count
      FROM public.certifications AS c
      INNER JOIN public.users AS u
        ON u.id::text = c.user_id
      WHERE u.organization_id = p_organization_id
        AND c.awarded_at::date BETWEEN v_start_date AND v_end_date
      GROUP BY c.awarded_at::date, COALESCE(c.tier, 'bronze')
    ) AS bucketed
    GROUP BY bucketed.bucket_date
  )
  INSERT INTO public.academy_analytics_daily_summary (
    organization_id,
    bucket_date,
    quiz_attempts,
    quiz_passed,
    quiz_score_total,
    quiz_distinct_users,
    simulation_attempts,
    simulation_passed,
    simulation_score_total,
    certifications_awarded,
    quiz_pillar_breakdown,
    certification_tier_breakdown,
    refreshed_at
  )
  SELECT
    p_organization_id,
    db.bucket_date,
    COALESCE(qd.attempts, 0),
    COALESCE(qd.passed, 0),
    COALESCE(qd.score_total, 0),
    COALESCE(qd.distinct_users, 0),
    COALESCE(sd.attempts, 0),
    COALESCE(sd.passed, 0),
    COALESCE(sd.score_total, 0),
    COALESCE(cd.certifications_awarded, 0),
    COALESCE(qpd.pillar_breakdown, '[]'::jsonb),
    COALESCE(ctd.tier_breakdown, '[]'::jsonb),
    now()
  FROM date_buckets AS db
  LEFT JOIN quiz_daily AS qd
    ON qd.bucket_date = db.bucket_date
  LEFT JOIN quiz_pillar_daily AS qpd
    ON qpd.bucket_date = db.bucket_date
  LEFT JOIN simulation_daily AS sd
    ON sd.bucket_date = db.bucket_date
  LEFT JOIN certification_daily AS cd
    ON cd.bucket_date = db.bucket_date
  LEFT JOIN certification_tier_daily AS ctd
    ON ctd.bucket_date = db.bucket_date;
END;
$$;

REVOKE ALL ON FUNCTION public.get_academy_quiz_stats(uuid, timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_academy_certification_stats(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_academy_simulation_stats(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_academy_analytics_daily_summary(uuid, date, date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_academy_quiz_stats(uuid, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_academy_certification_stats(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_academy_simulation_stats(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_academy_analytics_daily_summary(uuid, date, date) TO service_role;
