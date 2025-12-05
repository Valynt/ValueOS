-- Offline Evaluation Schema
-- Stores golden examples and evaluation runs for Eval-Driven Development

-- Golden Examples Table
CREATE TABLE IF NOT EXISTS golden_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('OpportunityAgent', 'TargetAgent', 'IntegrityAgent', 'ReflectionEngine')),
  input JSONB NOT NULL,
  expected_output JSONB NOT NULL,
  evaluation_criteria JSONB NOT NULL, -- [{metric, threshold, weight}]
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evaluation Runs Table
CREATE TABLE IF NOT EXISTS evaluation_runs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  agent_type TEXT,
  prompt_version TEXT,
  results JSONB NOT NULL, -- Array of EvaluationResult
  summary JSONB NOT NULL, -- {totalExamples, passed, failed, passRate, avgScore, avgDuration}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_golden_examples_agent_type ON golden_examples(agent_type);
CREATE INDEX IF NOT EXISTS idx_golden_examples_created ON golden_examples(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_agent_type ON evaluation_runs(agent_type);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_created ON evaluation_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_prompt_version ON evaluation_runs(prompt_version);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_golden_example_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_golden_example_timestamp
BEFORE UPDATE ON golden_examples
FOR EACH ROW
EXECUTE FUNCTION update_golden_example_timestamp();

-- Function to get evaluation statistics
CREATE OR REPLACE FUNCTION get_evaluation_statistics(p_agent_type TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'totalRuns', COUNT(*),
    'avgPassRate', AVG((summary->>'passRate')::float),
    'avgScore', AVG((summary->>'avgScore')::float),
    'avgDuration', AVG((summary->>'avgDuration')::float),
    'latestRun', MAX(created_at),
    'trendData', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', created_at,
          'passRate', (summary->>'passRate')::float,
          'avgScore', (summary->>'avgScore')::float
        )
        ORDER BY created_at DESC
      )
      FROM (
        SELECT created_at, summary
        FROM evaluation_runs
        WHERE agent_type = p_agent_type
        ORDER BY created_at DESC
        LIMIT 10
      ) recent_runs
    )
  )
  INTO result
  FROM evaluation_runs
  WHERE agent_type = p_agent_type;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to detect regressions
CREATE OR REPLACE FUNCTION detect_regressions(
  p_agent_type TEXT,
  p_threshold FLOAT DEFAULT 0.05
)
RETURNS TABLE (
  example_name TEXT,
  previous_score FLOAT,
  current_score FLOAT,
  score_diff FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_two_runs AS (
    SELECT id, results
    FROM evaluation_runs
    WHERE agent_type = p_agent_type
    ORDER BY created_at DESC
    LIMIT 2
  ),
  current_run AS (
    SELECT id, results FROM latest_two_runs LIMIT 1
  ),
  previous_run AS (
    SELECT id, results FROM latest_two_runs OFFSET 1 LIMIT 1
  )
  SELECT 
    (curr_result->>'exampleName')::TEXT as example_name,
    (prev_result->>'overallScore')::FLOAT as previous_score,
    (curr_result->>'overallScore')::FLOAT as current_score,
    ((curr_result->>'overallScore')::FLOAT - (prev_result->>'overallScore')::FLOAT) as score_diff
  FROM 
    current_run,
    jsonb_array_elements(current_run.results) curr_result,
    previous_run,
    jsonb_array_elements(previous_run.results) prev_result
  WHERE 
    curr_result->>'exampleId' = prev_result->>'exampleId'
    AND ((curr_result->>'overallScore')::FLOAT - (prev_result->>'overallScore')::FLOAT) < -p_threshold
  ORDER BY score_diff ASC;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE golden_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_runs ENABLE ROW LEVEL SECURITY;

-- Policies for golden_examples
CREATE POLICY "Golden examples are viewable by authenticated users"
  ON golden_examples FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Golden examples are insertable by authenticated users"
  ON golden_examples FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Golden examples are updatable by authenticated users"
  ON golden_examples FOR UPDATE
  TO authenticated
  USING (true);

-- Policies for evaluation_runs
CREATE POLICY "Evaluation runs are viewable by authenticated users"
  ON evaluation_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Evaluation runs are insertable by authenticated users"
  ON evaluation_runs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Sample golden examples
INSERT INTO golden_examples (name, description, agent_type, input, expected_output, evaluation_criteria, metadata) VALUES
(
  'Technology SaaS Value Proposition',
  'Generate value proposition for a SaaS project management tool',
  'OpportunityAgent',
  jsonb_build_object(
    'businessDescription', 'A cloud-based project management platform with AI-powered insights',
    'industry', 'Technology',
    'targetMarket', 'SMBs'
  ),
  jsonb_build_object(
    'keywords', ARRAY['collaboration', 'real-time', 'AI', 'insights', 'productivity'],
    'minLength', 50,
    'maxLength', 200
  ),
  jsonb_build_array(
    jsonb_build_object('metric', 'contains_keywords', 'threshold', 0.8, 'weight', 0.4),
    jsonb_build_object('metric', 'length_range', 'threshold', 1.0, 'weight', 0.2),
    jsonb_build_object('metric', 'semantic_similarity', 'threshold', 0.7, 'weight', 0.4)
  ),
  jsonb_build_object(
    'industry', 'Technology',
    'difficulty', 'medium',
    'tags', ARRAY['saas', 'project-management']
  )
),
(
  'Healthcare Target Definition',
  'Define target market for healthcare compliance software',
  'TargetAgent',
  jsonb_build_object(
    'businessDescription', 'HIPAA compliance automation software for healthcare providers',
    'industry', 'Healthcare'
  ),
  jsonb_build_object(
    'keywords', ARRAY['healthcare', 'providers', 'hospitals', 'clinics', 'compliance', 'HIPAA'],
    'minLength', 100,
    'maxLength', 300
  ),
  jsonb_build_array(
    jsonb_build_object('metric', 'contains_keywords', 'threshold', 0.7, 'weight', 0.5),
    jsonb_build_object('metric', 'length_range', 'threshold', 1.0, 'weight', 0.2),
    jsonb_build_object('metric', 'semantic_similarity', 'threshold', 0.75, 'weight', 0.3)
  ),
  jsonb_build_object(
    'industry', 'Healthcare',
    'difficulty', 'hard',
    'tags', ARRAY['compliance', 'healthcare']
  )
),
(
  'Integrity Check - Missing Compliance',
  'Detect missing compliance considerations',
  'IntegrityAgent',
  jsonb_build_object(
    'content', 'A financial services platform for retail investors',
    'industry', 'Finance'
  ),
  jsonb_build_object(
    'keywords', ARRAY['SEC', 'compliance', 'regulation', 'KYC', 'AML'],
    'minIssues', 1
  ),
  jsonb_build_array(
    jsonb_build_object('metric', 'contains_keywords', 'threshold', 0.6, 'weight', 0.7),
    jsonb_build_object('metric', 'json_structure', 'threshold', 1.0, 'weight', 0.3)
  ),
  jsonb_build_object(
    'industry', 'Finance',
    'difficulty', 'hard',
    'tags', ARRAY['compliance', 'finance']
  )
);

-- Comments
COMMENT ON TABLE golden_examples IS 'Golden dataset for offline evaluation of agent outputs';
COMMENT ON TABLE evaluation_runs IS 'Historical evaluation runs for tracking agent performance over time';
COMMENT ON COLUMN golden_examples.evaluation_criteria IS 'Array of {metric, threshold, weight} objects defining how to evaluate output';
COMMENT ON COLUMN evaluation_runs.results IS 'Array of EvaluationResult objects with scores for each example';
COMMENT ON COLUMN evaluation_runs.summary IS 'Aggregate statistics: totalExamples, passed, failed, passRate, avgScore, avgDuration';
COMMENT ON FUNCTION get_evaluation_statistics IS 'Get aggregate statistics and trends for an agent type';
COMMENT ON FUNCTION detect_regressions IS 'Compare latest two evaluation runs to detect performance regressions';
