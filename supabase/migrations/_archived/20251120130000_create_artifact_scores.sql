/*
  # Artifact Scoring System
  
  Creates table for storing artifact quality scores and evaluations.
  Supports reinforcement learning and continuous improvement.
*/

-- ============================================================================
-- 1. Artifact Scores Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS artifact_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Artifact identification
  artifact_type text NOT NULL CHECK (artifact_type IN (
    'system_map',
    'intervention_point',
    'outcome_hypothesis',
    'feedback_loop',
    'financial_model',
    'discovery_data',
    'business_case',
    'report'
  )),
  artifact_id uuid NOT NULL,
  
  -- Scoring
  overall_score numeric(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  quality_score numeric(5,2),
  completeness_score numeric(5,2),
  accuracy_score numeric(5,2),
  usefulness_score numeric(5,2),
  
  -- Detailed metrics
  metrics jsonb DEFAULT '{}'::jsonb,
  
  -- Evaluation context
  evaluator_type text CHECK (evaluator_type IN ('agent', 'user', 'system')),
  evaluator_id text,
  evaluation_criteria jsonb DEFAULT '{}'::jsonb,
  
  -- Recommendations
  recommendations text[],
  improvement_suggestions jsonb DEFAULT '[]'::jsonb,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artifact_scores_artifact ON artifact_scores(artifact_type, artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_scores_overall ON artifact_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_scores_quality ON artifact_scores(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_scores_evaluator ON artifact_scores(evaluator_type, evaluator_id);
CREATE INDEX IF NOT EXISTS idx_artifact_scores_created ON artifact_scores(created_at DESC);

COMMENT ON TABLE artifact_scores IS 'Quality scores and evaluations for all artifacts';

-- ============================================================================
-- 2. Score History Table (for tracking improvements)
-- ============================================================================

CREATE TABLE IF NOT EXISTS artifact_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_score_id uuid REFERENCES artifact_scores(id) ON DELETE CASCADE,
  
  previous_score numeric(5,2),
  new_score numeric(5,2),
  score_delta numeric(5,2),
  
  change_reason text,
  improvements_made text[],
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_history_artifact ON artifact_score_history(artifact_score_id);
CREATE INDEX IF NOT EXISTS idx_score_history_created ON artifact_score_history(created_at DESC);

COMMENT ON TABLE artifact_score_history IS 'Historical record of score changes for tracking improvements';

-- ============================================================================
-- 3. RLS Policies
-- ============================================================================

ALTER TABLE artifact_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_score_history ENABLE ROW LEVEL SECURITY;

-- Users can view scores for artifacts they have access to
CREATE POLICY "Users can view artifact scores"
  ON artifact_scores FOR SELECT
  USING (true); -- Simplified for now, should check artifact ownership

-- System can insert and update scores
CREATE POLICY "System can manage artifact scores"
  ON artifact_scores FOR ALL
  USING (true)
  WITH CHECK (true);

-- Users can view score history
CREATE POLICY "Users can view score history"
  ON artifact_score_history FOR SELECT
  USING (true);

-- System can insert score history
CREATE POLICY "System can insert score history"
  ON artifact_score_history FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 4. Helper Functions
-- ============================================================================

-- Store or update artifact score
CREATE OR REPLACE FUNCTION store_artifact_score(
  p_artifact_type text,
  p_artifact_id uuid,
  p_overall_score numeric,
  p_quality_score numeric,
  p_completeness_score numeric,
  p_accuracy_score numeric,
  p_usefulness_score numeric,
  p_evaluator_type text,
  p_evaluator_id text,
  p_recommendations text[],
  p_metrics jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_score_id uuid;
  v_existing_score numeric;
BEGIN
  -- Check if score already exists
  SELECT id, overall_score INTO v_score_id, v_existing_score
  FROM artifact_scores
  WHERE artifact_type = p_artifact_type
    AND artifact_id = p_artifact_id
    AND evaluator_type = p_evaluator_type
    AND evaluator_id = p_evaluator_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_score_id IS NOT NULL THEN
    -- Update existing score
    UPDATE artifact_scores
    SET
      overall_score = p_overall_score,
      quality_score = p_quality_score,
      completeness_score = p_completeness_score,
      accuracy_score = p_accuracy_score,
      usefulness_score = p_usefulness_score,
      recommendations = p_recommendations,
      metrics = p_metrics,
      updated_at = now()
    WHERE id = v_score_id;

    -- Record history
    INSERT INTO artifact_score_history (
      artifact_score_id,
      previous_score,
      new_score,
      score_delta,
      change_reason
    ) VALUES (
      v_score_id,
      v_existing_score,
      p_overall_score,
      p_overall_score - v_existing_score,
      'Score updated'
    );
  ELSE
    -- Insert new score
    INSERT INTO artifact_scores (
      artifact_type,
      artifact_id,
      overall_score,
      quality_score,
      completeness_score,
      accuracy_score,
      usefulness_score,
      evaluator_type,
      evaluator_id,
      recommendations,
      metrics
    ) VALUES (
      p_artifact_type,
      p_artifact_id,
      p_overall_score,
      p_quality_score,
      p_completeness_score,
      p_accuracy_score,
      p_usefulness_score,
      p_evaluator_type,
      p_evaluator_id,
      p_recommendations,
      p_metrics
    )
    RETURNING id INTO v_score_id;
  END IF;

  RETURN v_score_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get latest score for an artifact
CREATE OR REPLACE FUNCTION get_artifact_score(
  p_artifact_type text,
  p_artifact_id uuid
)
RETURNS TABLE (
  score_id uuid,
  overall_score numeric,
  quality_score numeric,
  completeness_score numeric,
  accuracy_score numeric,
  usefulness_score numeric,
  recommendations text[],
  evaluator_type text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id as score_id,
    artifact_scores.overall_score,
    artifact_scores.quality_score,
    artifact_scores.completeness_score,
    artifact_scores.accuracy_score,
    artifact_scores.usefulness_score,
    artifact_scores.recommendations,
    artifact_scores.evaluator_type,
    artifact_scores.created_at
  FROM artifact_scores
  WHERE artifact_type = p_artifact_type
    AND artifact_id = p_artifact_id
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get score statistics for artifact type
CREATE OR REPLACE FUNCTION get_artifact_type_stats(
  p_artifact_type text
)
RETURNS TABLE (
  artifact_type text,
  total_scored integer,
  average_score numeric,
  highest_score numeric,
  lowest_score numeric,
  score_trend numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_artifact_type as artifact_type,
    COUNT(*)::integer as total_scored,
    AVG(overall_score) as average_score,
    MAX(overall_score) as highest_score,
    MIN(overall_score) as lowest_score,
    0.0::numeric as score_trend -- Placeholder for trend calculation
  FROM artifact_scores
  WHERE artifact_scores.artifact_type = p_artifact_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Triggers
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_artifact_score_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_artifact_score_timestamp ON artifact_scores;
CREATE TRIGGER trigger_update_artifact_score_timestamp
  BEFORE UPDATE ON artifact_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_artifact_score_timestamp();
