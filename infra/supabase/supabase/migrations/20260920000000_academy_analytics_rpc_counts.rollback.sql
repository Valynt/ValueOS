-- Rollback: remove academy analytics aggregate counts from RPC payloads.

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
