/*
  # Episodic Memory System for LLM-MARL
  
  Creates tables for storing episodes, episode steps, and simulation results.
  Supports analogy-based retrieval and reinforcement learning.
*/

-- ============================================================================
-- 1. Episodes Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid,
  agent_id uuid,
  episode_type text NOT NULL CHECK (episode_type IN (
    'task_execution',
    'simulation',
    'learning',
    'coordination',
    'problem_solving'
  )),
  
  -- Episode metadata
  task_intent text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  initial_state jsonb DEFAULT '{}'::jsonb,
  final_state jsonb DEFAULT '{}'::jsonb,
  
  -- Outcome tracking
  success boolean,
  reward_score numeric(5,2),
  quality_score numeric(5,2),
  
  -- Timing
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_seconds integer,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  tags text[] DEFAULT ARRAY[]::text[],
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_episodes_session ON episodes(session_id);
CREATE INDEX IF NOT EXISTS idx_episodes_agent ON episodes(agent_id);
CREATE INDEX IF NOT EXISTS idx_episodes_type ON episodes(episode_type);
CREATE INDEX IF NOT EXISTS idx_episodes_success ON episodes(success);
CREATE INDEX IF NOT EXISTS idx_episodes_reward ON episodes(reward_score DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_started ON episodes(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_tags ON episodes USING gin(tags);

COMMENT ON TABLE episodes IS 'Stores complete episodes for episodic memory and reinforcement learning';

-- ============================================================================
-- 2. Episode Steps Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS episode_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  
  -- Step details
  action_type text NOT NULL,
  action_description text,
  agent_name text,
  
  -- State tracking
  state_before jsonb DEFAULT '{}'::jsonb,
  state_after jsonb DEFAULT '{}'::jsonb,
  
  -- Decision making
  reasoning text,
  confidence_score numeric(3,2),
  alternatives jsonb DEFAULT '[]'::jsonb,
  
  -- Outcome
  success boolean,
  error_message text,
  
  -- Timing
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_episode_steps_episode ON episode_steps(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_steps_number ON episode_steps(episode_id, step_number);
CREATE INDEX IF NOT EXISTS idx_episode_steps_agent ON episode_steps(agent_name);
CREATE INDEX IF NOT EXISTS idx_episode_steps_action ON episode_steps(action_type);

COMMENT ON TABLE episode_steps IS 'Individual steps within an episode for detailed analysis';

-- ============================================================================
-- 3. Episode Similarities Table (for analogy-based retrieval)
-- ============================================================================

CREATE TABLE IF NOT EXISTS episode_similarities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
  target_episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
  
  similarity_score numeric(3,2) NOT NULL,
  similarity_type text CHECK (similarity_type IN (
    'context',
    'outcome',
    'process',
    'combined'
  )),
  
  matching_features jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(source_episode_id, target_episode_id, similarity_type)
);

CREATE INDEX IF NOT EXISTS idx_episode_similarities_source ON episode_similarities(source_episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_similarities_target ON episode_similarities(target_episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_similarities_score ON episode_similarities(similarity_score DESC);

COMMENT ON TABLE episode_similarities IS 'Pre-computed similarities between episodes for fast retrieval';

-- ============================================================================
-- 4. Simulation Results Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS simulation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
  
  -- Simulation config
  simulation_type text NOT NULL,
  parameters jsonb DEFAULT '{}'::jsonb,
  
  -- Results
  predicted_outcome jsonb NOT NULL,
  confidence_score numeric(3,2),
  risk_assessment jsonb DEFAULT '{}'::jsonb,
  
  -- Validation (if actual outcome is known)
  actual_outcome jsonb,
  prediction_accuracy numeric(3,2),
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulation_results_episode ON simulation_results(episode_id);
CREATE INDEX IF NOT EXISTS idx_simulation_results_type ON simulation_results(simulation_type);
CREATE INDEX IF NOT EXISTS idx_simulation_results_confidence ON simulation_results(confidence_score DESC);

COMMENT ON TABLE simulation_results IS 'Results from simulated workflows for decision support';

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE episode_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE episode_similarities ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_results ENABLE ROW LEVEL SECURITY;

-- Episodes: users can view episodes from their sessions
CREATE POLICY "Users can view their episodes"
  ON episodes FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

-- Episodes: system can insert
CREATE POLICY "System can insert episodes"
  ON episodes FOR INSERT
  WITH CHECK (true);

-- Episode steps: users can view steps from their episodes
CREATE POLICY "Users can view their episode steps"
  ON episode_steps FOR SELECT
  USING (
    episode_id IN (
      SELECT id FROM episodes
      WHERE session_id IN (
        SELECT id FROM sessions WHERE user_id = auth.uid()
      )
    )
  );

-- Episode steps: system can insert
CREATE POLICY "System can insert episode steps"
  ON episode_steps FOR INSERT
  WITH CHECK (true);

-- Similarities: users can view similarities for their episodes
CREATE POLICY "Users can view episode similarities"
  ON episode_similarities FOR SELECT
  USING (
    source_episode_id IN (
      SELECT id FROM episodes
      WHERE session_id IN (
        SELECT id FROM sessions WHERE user_id = auth.uid()
      )
    )
  );

-- Simulation results: users can view their simulation results
CREATE POLICY "Users can view their simulation results"
  ON simulation_results FOR SELECT
  USING (
    episode_id IN (
      SELECT id FROM episodes
      WHERE session_id IN (
        SELECT id FROM sessions WHERE user_id = auth.uid()
      )
    )
  );

-- Simulation results: system can insert
CREATE POLICY "System can insert simulation results"
  ON simulation_results FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 6. Helper Functions
-- ============================================================================

-- Store a complete episode
CREATE OR REPLACE FUNCTION store_episode(
  p_session_id uuid,
  p_agent_id uuid,
  p_episode_type text,
  p_task_intent text,
  p_context jsonb,
  p_initial_state jsonb,
  p_final_state jsonb,
  p_success boolean,
  p_reward_score numeric,
  p_duration_seconds integer
)
RETURNS uuid AS $$
DECLARE
  v_episode_id uuid;
BEGIN
  INSERT INTO episodes (
    session_id,
    agent_id,
    episode_type,
    task_intent,
    context,
    initial_state,
    final_state,
    success,
    reward_score,
    completed_at,
    duration_seconds
  ) VALUES (
    p_session_id,
    p_agent_id,
    p_episode_type,
    p_task_intent,
    p_context,
    p_initial_state,
    p_final_state,
    p_success,
    p_reward_score,
    now(),
    p_duration_seconds
  )
  RETURNING id INTO v_episode_id;
  
  RETURN v_episode_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Store an episode step
CREATE OR REPLACE FUNCTION store_episode_step(
  p_episode_id uuid,
  p_step_number integer,
  p_action_type text,
  p_action_description text,
  p_agent_name text,
  p_state_before jsonb,
  p_state_after jsonb,
  p_reasoning text,
  p_success boolean
)
RETURNS uuid AS $$
DECLARE
  v_step_id uuid;
BEGIN
  INSERT INTO episode_steps (
    episode_id,
    step_number,
    action_type,
    action_description,
    agent_name,
    state_before,
    state_after,
    reasoning,
    success,
    completed_at
  ) VALUES (
    p_episode_id,
    p_step_number,
    p_action_type,
    p_action_description,
    p_agent_name,
    p_state_before,
    p_state_after,
    p_reasoning,
    p_success,
    now()
  )
  RETURNING id INTO v_step_id;
  
  RETURN v_step_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retrieve similar episodes
CREATE OR REPLACE FUNCTION retrieve_similar_episodes(
  p_context jsonb,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  episode_id uuid,
  task_intent text,
  context jsonb,
  success boolean,
  reward_score numeric,
  similarity_score numeric
) AS $$
BEGIN
  -- Simple similarity based on context overlap
  -- In production, use vector embeddings
  RETURN QUERY
  SELECT
    e.id as episode_id,
    e.task_intent,
    e.context,
    e.success,
    e.reward_score,
    0.5::numeric as similarity_score -- Placeholder
  FROM episodes e
  WHERE e.success = true
    AND e.reward_score > 0.5
  ORDER BY e.reward_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Score an episode
CREATE OR REPLACE FUNCTION score_episode(
  p_episode_id uuid,
  p_reward_score numeric,
  p_quality_score numeric
)
RETURNS void AS $$
BEGIN
  UPDATE episodes
  SET
    reward_score = p_reward_score,
    quality_score = p_quality_score,
    updated_at = now()
  WHERE id = p_episode_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Triggers
-- ============================================================================

-- Update episode duration when completed
CREATE OR REPLACE FUNCTION update_episode_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::integer;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_episode_duration ON episodes;
CREATE TRIGGER trigger_update_episode_duration
  BEFORE UPDATE ON episodes
  FOR EACH ROW
  EXECUTE FUNCTION update_episode_duration();

-- Update step duration when completed
CREATE OR REPLACE FUNCTION update_step_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    NEW.duration_ms := EXTRACT(MILLISECONDS FROM (NEW.completed_at - NEW.started_at))::integer;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_step_duration ON episode_steps;
CREATE TRIGGER trigger_update_step_duration
  BEFORE UPDATE ON episode_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_step_duration();
