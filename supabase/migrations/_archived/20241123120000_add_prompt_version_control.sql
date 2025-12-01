-- Prompt Version Control Schema
-- Enables versioning, A/B testing, and optimization of LLM prompts

-- Prompt Versions Table
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  template TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  performance JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('draft', 'testing', 'active', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ,
  UNIQUE(prompt_key, version)
);

-- Prompt Executions Table
CREATE TABLE IF NOT EXISTS prompt_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  variables JSONB NOT NULL DEFAULT '{}',
  rendered_prompt TEXT NOT NULL,
  response TEXT,
  latency INTEGER, -- milliseconds
  cost DECIMAL(10, 6), -- USD
  tokens JSONB, -- {prompt, completion, total}
  success BOOLEAN,
  error TEXT,
  feedback JSONB, -- {rating, comment}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A/B Tests Table
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt_key TEXT NOT NULL,
  variants JSONB NOT NULL, -- [{name, versionId, weight}]
  status TEXT NOT NULL CHECK (status IN ('draft', 'running', 'completed')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompt_versions_key_status ON prompt_versions(prompt_key, status);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_key_version ON prompt_versions(prompt_key, version DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_executions_version ON prompt_executions(prompt_version_id);
CREATE INDEX IF NOT EXISTS idx_prompt_executions_user ON prompt_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_executions_created ON prompt_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ab_tests_key_status ON ab_tests(prompt_key, status);

-- Function to get active prompt version
CREATE OR REPLACE FUNCTION get_active_prompt_version(p_prompt_key TEXT)
RETURNS prompt_versions AS $$
  SELECT *
  FROM prompt_versions
  WHERE prompt_key = p_prompt_key
    AND status = 'active'
  ORDER BY version DESC
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Function to calculate version performance
CREATE OR REPLACE FUNCTION calculate_version_performance(p_version_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'avgLatency', AVG(latency),
    'avgCost', AVG(cost),
    'avgTokens', AVG((tokens->>'total')::INTEGER),
    'successRate', AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END),
    'userSatisfaction', AVG((feedback->>'rating')::NUMERIC),
    'executionCount', COUNT(*)
  )
  INTO result
  FROM prompt_executions
  WHERE prompt_version_id = p_version_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get A/B test results
CREATE OR REPLACE FUNCTION get_ab_test_results(p_test_id UUID)
RETURNS JSONB AS $$
DECLARE
  test_record ab_tests;
  variant JSONB;
  results JSONB := '[]'::JSONB;
  variant_result JSONB;
BEGIN
  SELECT * INTO test_record FROM ab_tests WHERE id = p_test_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  FOR variant IN SELECT * FROM jsonb_array_elements(test_record.variants)
  LOOP
    SELECT jsonb_build_object(
      'variant', variant->>'name',
      'executions', COUNT(*),
      'avgLatency', AVG(latency),
      'avgCost', AVG(cost),
      'successRate', AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END),
      'userSatisfaction', AVG((feedback->>'rating')::NUMERIC)
    )
    INTO variant_result
    FROM prompt_executions
    WHERE prompt_version_id = (variant->>'versionId')::UUID;
    
    results := results || jsonb_build_array(variant_result);
  END LOOP;
  
  RETURN results;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update version performance on execution
CREATE OR REPLACE FUNCTION update_version_performance_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.success IS NOT NULL THEN
    UPDATE prompt_versions
    SET performance = calculate_version_performance(NEW.prompt_version_id)
    WHERE id = NEW.prompt_version_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_version_performance
AFTER INSERT OR UPDATE ON prompt_executions
FOR EACH ROW
WHEN (NEW.success IS NOT NULL)
EXECUTE FUNCTION update_version_performance_trigger();

-- Row Level Security
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;

-- Policies for prompt_versions
CREATE POLICY "Prompt versions are viewable by authenticated users"
  ON prompt_versions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Prompt versions are insertable by authenticated users"
  ON prompt_versions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Prompt versions are updatable by authenticated users"
  ON prompt_versions FOR UPDATE
  TO authenticated
  USING (true);

-- Policies for prompt_executions
CREATE POLICY "Users can view their own executions"
  ON prompt_executions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own executions"
  ON prompt_executions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own executions"
  ON prompt_executions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for ab_tests
CREATE POLICY "A/B tests are viewable by authenticated users"
  ON ab_tests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "A/B tests are insertable by authenticated users"
  ON ab_tests FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "A/B tests are updatable by authenticated users"
  ON ab_tests FOR UPDATE
  TO authenticated
  USING (true);

-- Sample prompts
INSERT INTO prompt_versions (prompt_key, version, template, variables, metadata, status) VALUES
(
  'canvas.generate',
  1,
  'Generate a comprehensive business model canvas for the following business:

Business Description: {{businessDescription}}
Industry: {{industry}}
Target Market: {{targetMarket}}

Please provide a detailed business model canvas with the following sections:
1. Key Partners
2. Key Activities
3. Value Propositions
4. Customer Relationships
5. Customer Segments
6. Key Resources
7. Channels
8. Cost Structure
9. Revenue Streams

Format the response as JSON.',
  ARRAY['businessDescription', 'industry', 'targetMarket'],
  jsonb_build_object(
    'author', 'system',
    'description', 'Initial canvas generation prompt',
    'tags', ARRAY['canvas', 'generation'],
    'model', 'meta-llama/Llama-3-70b-chat-hf',
    'temperature', 0.7,
    'maxTokens', 1000
  ),
  'active'
),
(
  'canvas.refine',
  1,
  'Refine the following section of a business model canvas:

Section: {{section}}
Current Content: {{currentContent}}
Context: {{context}}

Please provide 3-5 specific, actionable suggestions to improve this section. Consider:
- Industry best practices
- Market trends
- Competitive advantages
- Scalability

Format the response as JSON with an array of suggestions.',
  ARRAY['section', 'currentContent', 'context'],
  jsonb_build_object(
    'author', 'system',
    'description', 'Canvas section refinement prompt',
    'tags', ARRAY['canvas', 'refinement'],
    'model', 'meta-llama/Llama-3-70b-chat-hf',
    'temperature', 0.8,
    'maxTokens', 500
  ),
  'active'
);

-- Comments
COMMENT ON TABLE prompt_versions IS 'Stores versioned LLM prompts with metadata and performance metrics';
COMMENT ON TABLE prompt_executions IS 'Tracks individual prompt executions for performance analysis';
COMMENT ON TABLE ab_tests IS 'Manages A/B tests for prompt optimization';
COMMENT ON FUNCTION get_active_prompt_version IS 'Returns the currently active version of a prompt';
COMMENT ON FUNCTION calculate_version_performance IS 'Calculates aggregate performance metrics for a prompt version';
COMMENT ON FUNCTION get_ab_test_results IS 'Returns aggregated results for an A/B test';
