-- ============================================================================
-- VOS Academy Portal Schema
-- 
-- Tables for the Learning Academy, Progress Tracking, and Value Ledger.
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUM Types
-- ============================================================================

CREATE TYPE academy_pillar AS ENUM ('1', '2', '3', '4', '5', '6', '7');

CREATE TYPE role_track AS ENUM (
  'value_engineer',
  'account_executive', 
  'customer_success',
  'developer',
  'leadership'
);

CREATE TYPE content_type AS ENUM (
  'video',
  'article',
  'lab',
  'quiz',
  'exercise',
  'template'
);

CREATE TYPE certification_level AS ENUM (
  'practitioner',
  'professional',
  'architect'
);

CREATE TYPE progress_status AS ENUM (
  'not_started',
  'in_progress',
  'completed'
);

CREATE TYPE lifecycle_stage_resource AS ENUM (
  'opportunity',
  'alignment',
  'realization',
  'expansion'
);

-- ============================================================================
-- Academy Modules Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS academy_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar academy_pillar NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_academy_modules_pillar_order ON academy_modules(pillar, display_order);

-- ============================================================================
-- Academy Lessons Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS academy_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES academy_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content_type content_type NOT NULL DEFAULT 'article',
  display_order INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 10,
  sdui_components JSONB DEFAULT '[]'::jsonb,
  prerequisites UUID[] DEFAULT '{}',
  tracks role_track[] DEFAULT '{}',
  lab_config JSONB,
  quiz_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_academy_lessons_module ON academy_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_academy_lessons_order ON academy_lessons(module_id, display_order);
CREATE INDEX IF NOT EXISTS idx_academy_lessons_type ON academy_lessons(content_type);

-- ============================================================================
-- User Progress Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS academy_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  status progress_status NOT NULL DEFAULT 'not_started',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  attempts INTEGER NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, lesson_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_academy_progress_user ON academy_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_progress_lesson ON academy_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_academy_progress_status ON academy_progress(user_id, status);

-- ============================================================================
-- Certifications Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS academy_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level certification_level NOT NULL,
  track role_track,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  certificate_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  UNIQUE(user_id, level, track)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_academy_certifications_user ON academy_certifications(user_id);

-- ============================================================================
-- Value Ledger Table (Gamification)
-- ============================================================================

CREATE TABLE IF NOT EXISTS value_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value_case_id UUID NOT NULL,  -- FK added conditionally below
  value_realized DECIMAL(15, 2) NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_by TEXT NOT NULL CHECK (verified_by IN ('realization_agent', 'manual')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, value_case_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_value_ledger_user ON value_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_value_ledger_value ON value_ledger(value_realized DESC);

-- Add FK to value_cases if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'value_cases') THEN
    -- Add FK constraint if it doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'value_ledger_value_case_id_fkey'
    ) THEN
      ALTER TABLE value_ledger 
        ADD CONSTRAINT value_ledger_value_case_id_fkey 
        FOREIGN KEY (value_case_id) 
        REFERENCES value_cases(id) 
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- Resource Artifacts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS resource_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lifecycle_stage lifecycle_stage_resource NOT NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('template', 'calculator', 'deck', 'guide', 'script')),
  file_url TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  deprecated BOOLEAN NOT NULL DEFAULT FALSE,
  replaced_by UUID REFERENCES resource_artifacts(id),
  linked_pillars academy_pillar[] DEFAULT '{}',
  governance_required BOOLEAN NOT NULL DEFAULT FALSE,
  integrity_validated BOOLEAN NOT NULL DEFAULT FALSE,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_resource_artifacts_stage ON resource_artifacts(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_resource_artifacts_type ON resource_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_resource_artifacts_active ON resource_artifacts(deprecated) WHERE deprecated = FALSE;

-- ============================================================================
-- Contextual Triggers Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS contextual_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_selector TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('dwell', 'error', 'help_click')),
  dwell_time_ms INTEGER,
  error_code TEXT,
  inject_content JSONB NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_contextual_triggers_enabled ON contextual_triggers(enabled) WHERE enabled = TRUE;

-- ============================================================================
-- Views
-- ============================================================================

-- User pillar progress summary
CREATE OR REPLACE VIEW user_pillar_progress AS
SELECT 
  ap.user_id,
  am.pillar,
  COUNT(al.id) as total_lessons,
  COUNT(ap.id) FILTER (WHERE ap.status = 'completed') as completed_lessons,
  ROUND(
    (COUNT(ap.id) FILTER (WHERE ap.status = 'completed')::DECIMAL / NULLIF(COUNT(al.id), 0)) * 100,
    1
  ) as percent_complete,
  SUM(al.estimated_minutes) FILTER (WHERE ap.status != 'completed') as minutes_remaining
FROM academy_modules am
JOIN academy_lessons al ON al.module_id = am.id
LEFT JOIN academy_progress ap ON ap.lesson_id = al.id
GROUP BY ap.user_id, am.pillar;

-- Leaderboard view
CREATE OR REPLACE VIEW value_leaderboard AS
SELECT 
  u.id as user_id,
  u.raw_user_meta_data->>'full_name' as user_name,
  u.raw_user_meta_data->>'avatar_url' as avatar_url,
  COALESCE(SUM(vl.value_realized), 0) as total_value_realized,
  COUNT(DISTINCT vl.value_case_id) as value_cases_completed,
  (SELECT level FROM academy_certifications WHERE user_id = u.id ORDER BY 
    CASE level 
      WHEN 'architect' THEN 3 
      WHEN 'professional' THEN 2 
      WHEN 'practitioner' THEN 1 
    END DESC LIMIT 1
  ) as highest_certification,
  RANK() OVER (ORDER BY COALESCE(SUM(vl.value_realized), 0) DESC) as rank
FROM auth.users u
LEFT JOIN value_ledger vl ON vl.user_id = u.id
GROUP BY u.id;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE academy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contextual_triggers ENABLE ROW LEVEL SECURITY;

-- Modules & Lessons: Everyone can read
CREATE POLICY "Academy modules are viewable by authenticated users"
  ON academy_modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Academy lessons are viewable by authenticated users"
  ON academy_lessons FOR SELECT
  TO authenticated
  USING (true);

-- Progress: Users can only see/modify their own
CREATE POLICY "Users can view own progress"
  ON academy_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON academy_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON academy_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Certifications: Users can see own, admins can manage
CREATE POLICY "Users can view own certifications"
  ON academy_certifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Value Ledger: Users can see own + leaderboard is public
CREATE POLICY "Users can view own ledger entries"
  ON value_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Resources: Everyone can read active resources
CREATE POLICY "Resource artifacts are viewable by authenticated users"
  ON resource_artifacts FOR SELECT
  TO authenticated
  USING (deprecated = FALSE);

-- Triggers: Everyone can read enabled triggers
CREATE POLICY "Contextual triggers are viewable by authenticated users"
  ON contextual_triggers FOR SELECT
  TO authenticated
  USING (enabled = TRUE);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to update lesson progress
CREATE OR REPLACE FUNCTION update_lesson_progress(
  p_user_id UUID,
  p_lesson_id UUID,
  p_status progress_status,
  p_score INTEGER DEFAULT NULL,
  p_time_spent INTEGER DEFAULT 0
)
RETURNS academy_progress
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_progress academy_progress;
BEGIN
  INSERT INTO academy_progress (user_id, lesson_id, status, score, time_spent_seconds, started_at, completed_at, attempts)
  VALUES (
    p_user_id,
    p_lesson_id,
    p_status,
    p_score,
    p_time_spent,
    CASE WHEN p_status != 'not_started' THEN NOW() ELSE NULL END,
    CASE WHEN p_status = 'completed' THEN NOW() ELSE NULL END,
    CASE WHEN p_status = 'completed' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, lesson_id) DO UPDATE SET
    status = EXCLUDED.status,
    score = COALESCE(EXCLUDED.score, academy_progress.score),
    time_spent_seconds = academy_progress.time_spent_seconds + EXCLUDED.time_spent_seconds,
    completed_at = CASE WHEN EXCLUDED.status = 'completed' AND academy_progress.completed_at IS NULL THEN NOW() ELSE academy_progress.completed_at END,
    attempts = CASE WHEN EXCLUDED.status = 'completed' THEN academy_progress.attempts + 1 ELSE academy_progress.attempts END,
    updated_at = NOW()
  RETURNING * INTO v_progress;
  
  RETURN v_progress;
END;
$$;

-- Function to check certification eligibility
CREATE OR REPLACE FUNCTION check_certification_eligibility(
  p_user_id UUID,
  p_level certification_level
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_completed_pillars INTEGER;
  v_has_value_commit BOOLEAN;
BEGIN
  -- Count completed pillars (all lessons in pillar completed)
  SELECT COUNT(DISTINCT am.pillar) INTO v_completed_pillars
  FROM academy_modules am
  WHERE NOT EXISTS (
    SELECT 1 FROM academy_lessons al
    LEFT JOIN academy_progress ap ON ap.lesson_id = al.id AND ap.user_id = p_user_id
    WHERE al.module_id = am.id
    AND (ap.status IS NULL OR ap.status != 'completed')
  );
  
  -- Check for verified value commit
  SELECT EXISTS (
    SELECT 1 FROM value_ledger WHERE user_id = p_user_id AND value_realized > 0
  ) INTO v_has_value_commit;
  
  CASE p_level
    WHEN 'practitioner' THEN
      RETURN v_completed_pillars >= 4; -- Core pillars 1-4
    WHEN 'professional' THEN
      RETURN v_completed_pillars >= 5 AND v_has_value_commit;
    WHEN 'architect' THEN
      RETURN v_completed_pillars >= 7 AND v_has_value_commit;
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_academy_modules_updated_at
  BEFORE UPDATE ON academy_modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_academy_lessons_updated_at
  BEFORE UPDATE ON academy_lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_academy_progress_updated_at
  BEFORE UPDATE ON academy_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resource_artifacts_updated_at
  BEFORE UPDATE ON resource_artifacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed Data: Pillar 1 (Outcome Economics) as pilot
-- ============================================================================

-- Insert Pillar 1 Module
INSERT INTO academy_modules (id, pillar, title, description, display_order, estimated_minutes)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '1',
  'Outcome Economics Fundamentals',
  'Master the Value Triad: Revenue, Cost, and Risk. Learn how multipliers and levers drive business outcomes.',
  1,
  60
);

-- Insert Pillar 1 Lessons
INSERT INTO academy_lessons (module_id, title, description, content_type, display_order, estimated_minutes, sdui_components)
VALUES 
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Introduction to Outcome Economics',
  'Why outcomes matter more than features. The shift from product-centric to value-centric selling.',
  'video',
  1,
  12,
  '["academy_video", "academy_quiz"]'
),
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'The Value Triad',
  'Understanding the three pillars of business value: Revenue acceleration, Cost reduction, and Risk mitigation.',
  'article',
  2,
  15,
  '["text_block", "diagram_block", "academy_quiz"]'
),
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Multipliers and Levers',
  'How small improvements compound into significant business impact.',
  'exercise',
  3,
  20,
  '["text_block", "interactive_calculator", "academy_quiz"]'
),
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Pillar 1 Assessment',
  'Test your understanding of Outcome Economics fundamentals.',
  'quiz',
  4,
  15,
  '["academy_quiz"]'
);

COMMENT ON TABLE academy_modules IS 'Academy curriculum modules organized by pillar';
COMMENT ON TABLE academy_lessons IS 'Individual lessons within academy modules';
COMMENT ON TABLE academy_progress IS 'User progress tracking for academy lessons';
COMMENT ON TABLE academy_certifications IS 'User earned certifications';
COMMENT ON TABLE value_ledger IS 'Tracks realized value for gamification leaderboard';
COMMENT ON TABLE resource_artifacts IS 'Downloadable templates and tools';
COMMENT ON TABLE contextual_triggers IS 'Rules for in-app contextual help injection';
