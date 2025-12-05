/*
  # UI Generation Metrics System
  
  Creates tables for tracking UI generation trajectories, user interactions,
  and effectiveness metrics for continuous improvement.
*/

-- ============================================================================
-- 1. UI Generation Trajectories Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ui_generation_trajectories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subgoal_id uuid NOT NULL,
  
  -- Generation details
  generation_method text NOT NULL CHECK (generation_method IN ('dynamic', 'static', 'hybrid')),
  llm_model text,
  tokens_used integer,
  generation_time_ms integer NOT NULL,
  
  -- Component selection
  components_selected text[] NOT NULL,
  layout_chosen text NOT NULL,
  
  -- Decision reasoning
  reasoning text,
  alternatives_considered text[] DEFAULT ARRAY[]::text[],
  confidence_score numeric(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Validation
  validation_passed boolean NOT NULL,
  validation_errors text[] DEFAULT ARRAY[]::text[],
  validation_warnings text[] DEFAULT ARRAY[]::text[],
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ui_trajectories_subgoal ON ui_generation_trajectories(subgoal_id);
CREATE INDEX IF NOT EXISTS idx_ui_trajectories_method ON ui_generation_trajectories(generation_method);
CREATE INDEX IF NOT EXISTS idx_ui_trajectories_created ON ui_generation_trajectories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ui_trajectories_components ON ui_generation_trajectories USING gin(components_selected);

COMMENT ON TABLE ui_generation_trajectories IS 'Tracks UI generation decisions and reasoning';

-- ============================================================================
-- 2. UI Interaction Events Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ui_interaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trajectory_id uuid REFERENCES ui_generation_trajectories(id) ON DELETE CASCADE,
  user_id uuid,
  
  -- Interaction details
  event_type text NOT NULL CHECK (event_type IN (
    'page_view',
    'component_click',
    'form_submit',
    'navigation',
    'error',
    'task_complete',
    'task_abandon'
  )),
  
  component_interacted text,
  interaction_data jsonb DEFAULT '{}'::jsonb,
  
  -- Timing
  time_on_page_ms integer,
  time_to_interaction_ms integer,
  
  -- Success indicators
  task_completed boolean DEFAULT false,
  user_satisfaction integer CHECK (user_satisfaction >= 1 AND user_satisfaction <= 5),
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ui_interactions_trajectory ON ui_interaction_events(trajectory_id);
CREATE INDEX IF NOT EXISTS idx_ui_interactions_user ON ui_interaction_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ui_interactions_type ON ui_interaction_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ui_interactions_created ON ui_interaction_events(created_at DESC);

COMMENT ON TABLE ui_interaction_events IS 'Tracks user interactions with generated UIs';

-- ============================================================================
-- 3. UI Generation Metrics Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ui_generation_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trajectory_id uuid REFERENCES ui_generation_trajectories(id) ON DELETE CASCADE UNIQUE,
  
  -- Goal completion
  goal_completion_rate numeric(3,2) CHECK (goal_completion_rate >= 0 AND goal_completion_rate <= 1),
  task_success boolean NOT NULL,
  
  -- Component effectiveness
  component_selection_accuracy numeric(3,2) CHECK (component_selection_accuracy >= 0 AND component_selection_accuracy <= 1),
  layout_effectiveness numeric(3,2) CHECK (layout_effectiveness >= 0 AND layout_effectiveness <= 1),
  
  -- User interaction
  user_interaction_success numeric(3,2) CHECK (user_interaction_success >= 0 AND user_interaction_success <= 1),
  time_to_first_interaction_ms integer,
  total_interactions integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  
  -- Performance
  generation_time_ms integer NOT NULL,
  tokens_used integer,
  cost_estimate numeric(10,4),
  
  -- Quality scores
  overall_quality_score numeric(5,2) CHECK (overall_quality_score >= 0 AND overall_quality_score <= 100),
  user_satisfaction_score numeric(2,1) CHECK (user_satisfaction_score >= 1 AND user_satisfaction_score <= 5),
  
  -- Improvement suggestions
  improvement_suggestions text[] DEFAULT ARRAY[]::text[],
  
  calculated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ui_metrics_trajectory ON ui_generation_metrics(trajectory_id);
CREATE INDEX IF NOT EXISTS idx_ui_metrics_quality ON ui_generation_metrics(overall_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_ui_metrics_success ON ui_generation_metrics(task_success);

COMMENT ON TABLE ui_generation_metrics IS 'Aggregated metrics for UI generation effectiveness';

-- ============================================================================
-- 4. UI Generation Feedback Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ui_generation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trajectory_id uuid REFERENCES ui_generation_trajectories(id) ON DELETE CASCADE,
  
  -- Feedback type
  feedback_type text NOT NULL CHECK (feedback_type IN ('automatic', 'user_explicit', 'system_inferred')),
  
  -- Feedback content
  what_worked text[] DEFAULT ARRAY[]::text[],
  what_failed text[] DEFAULT ARRAY[]::text[],
  suggestions text[] DEFAULT ARRAY[]::text[],
  
  -- Scores
  component_appropriateness integer CHECK (component_appropriateness >= 1 AND component_appropriateness <= 5),
  layout_clarity integer CHECK (layout_clarity >= 1 AND layout_clarity <= 5),
  task_ease integer CHECK (task_ease >= 1 AND task_ease <= 5),
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ui_feedback_trajectory ON ui_generation_feedback(trajectory_id);
CREATE INDEX IF NOT EXISTS idx_ui_feedback_type ON ui_generation_feedback(feedback_type);

COMMENT ON TABLE ui_generation_feedback IS 'Feedback on UI generation quality';

-- ============================================================================
-- 5. Component Usage Stats Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS component_usage_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name text NOT NULL UNIQUE,
  
  -- Usage counts
  total_uses integer NOT NULL DEFAULT 0,
  successful_uses integer NOT NULL DEFAULT 0,
  failed_uses integer NOT NULL DEFAULT 0,
  
  -- Performance
  average_generation_time_ms numeric(10,2),
  average_user_interaction_time_ms numeric(10,2),
  
  -- Success metrics
  success_rate numeric(3,2),
  user_satisfaction_avg numeric(2,1),
  
  -- Common patterns
  common_layouts text[] DEFAULT ARRAY[]::text[],
  common_prop_combinations jsonb DEFAULT '[]'::jsonb,
  
  -- Issues
  common_errors text[] DEFAULT ARRAY[]::text[],
  improvement_suggestions text[] DEFAULT ARRAY[]::text[],
  
  last_updated timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_component_stats_name ON component_usage_stats(component_name);
CREATE INDEX IF NOT EXISTS idx_component_stats_success ON component_usage_stats(success_rate DESC);

COMMENT ON TABLE component_usage_stats IS 'Aggregated statistics for component usage';

-- ============================================================================
-- 6. Layout Effectiveness Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS layout_effectiveness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_type text NOT NULL UNIQUE CHECK (layout_type IN (
    'default',
    'full_width',
    'two_column',
    'dashboard',
    'single_column'
  )),
  
  -- Usage
  total_uses integer NOT NULL DEFAULT 0,
  
  -- Effectiveness
  task_completion_rate numeric(3,2),
  average_time_to_completion_ms numeric(10,2),
  user_satisfaction_avg numeric(2,1),
  
  -- Best use cases
  best_for_data_types text[] DEFAULT ARRAY[]::text[],
  best_for_task_types text[] DEFAULT ARRAY[]::text[],
  
  last_updated timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_layout_effectiveness_type ON layout_effectiveness(layout_type);
CREATE INDEX IF NOT EXISTS idx_layout_effectiveness_completion ON layout_effectiveness(task_completion_rate DESC);

COMMENT ON TABLE layout_effectiveness IS 'Effectiveness metrics for different layout types';

-- ============================================================================
-- 7. RLS Policies
-- ============================================================================

ALTER TABLE ui_generation_trajectories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_interaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_generation_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_generation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE layout_effectiveness ENABLE ROW LEVEL SECURITY;

-- System can insert and read all
CREATE POLICY "System can manage trajectories"
  ON ui_generation_trajectories FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can manage interactions"
  ON ui_interaction_events FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can manage metrics"
  ON ui_generation_metrics FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can manage feedback"
  ON ui_generation_feedback FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can manage component stats"
  ON component_usage_stats FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can manage layout effectiveness"
  ON layout_effectiveness FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 8. Helper Functions
-- ============================================================================

-- Calculate metrics for a trajectory
CREATE OR REPLACE FUNCTION calculate_ui_generation_metrics(
  p_trajectory_id uuid
)
RETURNS void AS $$
DECLARE
  v_interactions record;
  v_trajectory record;
  v_goal_completion numeric;
  v_component_accuracy numeric;
  v_layout_effectiveness numeric;
  v_user_success numeric;
  v_overall_quality numeric;
BEGIN
  -- Get trajectory
  SELECT * INTO v_trajectory
  FROM ui_generation_trajectories
  WHERE id = p_trajectory_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trajectory not found: %', p_trajectory_id;
  END IF;

  -- Get interaction stats
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE task_completed = true) as completed,
    COUNT(*) FILTER (WHERE event_type = 'error') as errors,
    MIN(time_to_interaction_ms) as first_interaction,
    AVG(user_satisfaction) as avg_satisfaction
  INTO v_interactions
  FROM ui_interaction_events
  WHERE trajectory_id = p_trajectory_id;

  -- Calculate goal completion rate
  v_goal_completion := CASE
    WHEN v_interactions.total > 0 THEN
      v_interactions.completed::numeric / v_interactions.total
    ELSE 0
  END;

  -- Calculate component selection accuracy (based on validation)
  v_component_accuracy := CASE
    WHEN v_trajectory.validation_passed THEN 1.0
    ELSE 0.5
  END;

  -- Calculate layout effectiveness (based on interactions)
  v_layout_effectiveness := CASE
    WHEN v_interactions.total > 0 THEN
      (v_interactions.total - v_interactions.errors)::numeric / v_interactions.total
    ELSE 0.5
  END;

  -- Calculate user interaction success
  v_user_success := CASE
    WHEN v_interactions.total > 0 THEN
      (v_interactions.completed::numeric / v_interactions.total) * 0.7 +
      (1 - (v_interactions.errors::numeric / GREATEST(v_interactions.total, 1))) * 0.3
    ELSE 0
  END;

  -- Calculate overall quality score
  v_overall_quality := (
    v_goal_completion * 30 +
    v_component_accuracy * 25 +
    v_layout_effectiveness * 25 +
    v_user_success * 20
  );

  -- Insert or update metrics
  INSERT INTO ui_generation_metrics (
    trajectory_id,
    goal_completion_rate,
    task_success,
    component_selection_accuracy,
    layout_effectiveness,
    user_interaction_success,
    time_to_first_interaction_ms,
    total_interactions,
    error_count,
    generation_time_ms,
    tokens_used,
    overall_quality_score,
    user_satisfaction_score
  ) VALUES (
    p_trajectory_id,
    v_goal_completion,
    v_interactions.completed > 0,
    v_component_accuracy,
    v_layout_effectiveness,
    v_user_success,
    v_interactions.first_interaction,
    v_interactions.total,
    v_interactions.errors,
    v_trajectory.generation_time_ms,
    v_trajectory.tokens_used,
    v_overall_quality,
    v_interactions.avg_satisfaction
  )
  ON CONFLICT (trajectory_id) DO UPDATE SET
    goal_completion_rate = EXCLUDED.goal_completion_rate,
    task_success = EXCLUDED.task_success,
    component_selection_accuracy = EXCLUDED.component_selection_accuracy,
    layout_effectiveness = EXCLUDED.layout_effectiveness,
    user_interaction_success = EXCLUDED.user_interaction_success,
    time_to_first_interaction_ms = EXCLUDED.time_to_first_interaction_ms,
    total_interactions = EXCLUDED.total_interactions,
    error_count = EXCLUDED.error_count,
    overall_quality_score = EXCLUDED.overall_quality_score,
    user_satisfaction_score = EXCLUDED.user_satisfaction_score,
    calculated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update component usage stats
CREATE OR REPLACE FUNCTION update_component_usage_stats(
  p_component_name text,
  p_success boolean,
  p_generation_time_ms integer,
  p_layout text
)
RETURNS void AS $$
BEGIN
  INSERT INTO component_usage_stats (
    component_name,
    total_uses,
    successful_uses,
    failed_uses,
    average_generation_time_ms,
    common_layouts
  ) VALUES (
    p_component_name,
    1,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    p_generation_time_ms,
    ARRAY[p_layout]
  )
  ON CONFLICT (component_name) DO UPDATE SET
    total_uses = component_usage_stats.total_uses + 1,
    successful_uses = component_usage_stats.successful_uses + CASE WHEN p_success THEN 1 ELSE 0 END,
    failed_uses = component_usage_stats.failed_uses + CASE WHEN p_success THEN 0 ELSE 1 END,
    average_generation_time_ms = (
      component_usage_stats.average_generation_time_ms * component_usage_stats.total_uses +
      p_generation_time_ms
    ) / (component_usage_stats.total_uses + 1),
    success_rate = (component_usage_stats.successful_uses + CASE WHEN p_success THEN 1 ELSE 0 END)::numeric /
                   (component_usage_stats.total_uses + 1),
    common_layouts = array_append(component_usage_stats.common_layouts, p_layout),
    last_updated = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. Triggers
-- ============================================================================

-- Auto-calculate metrics when interactions are added
CREATE OR REPLACE FUNCTION trigger_calculate_metrics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_ui_generation_metrics(NEW.trajectory_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ui_interaction_metrics ON ui_interaction_events;
CREATE TRIGGER trigger_ui_interaction_metrics
  AFTER INSERT OR UPDATE ON ui_interaction_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_metrics();
