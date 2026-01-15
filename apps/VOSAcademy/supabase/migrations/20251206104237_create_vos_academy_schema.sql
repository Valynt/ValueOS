/*
  # VOS Academy Database Schema

  ## Overview
  Complete database schema for the VOS (Value Operating System) Academy platform,
  including user management, curriculum tracking, assessments, certifications,
  and simulation scenarios.

  ## New Tables

  ### 1. users
  - `id` (uuid, primary key) - User identifier
  - `open_id` (text, unique) - External authentication ID
  - `name` (text) - User's full name
  - `email` (text) - User's email address
  - `login_method` (text) - Authentication method used
  - `role` (text) - System role
  - `vos_role` (text) - VOS-specific role (CSM, Sales, etc.)
  - `maturity_level` (integer) - Current maturity level (1-5)
  - `last_signed_in` (timestamptz) - Last login timestamp
  - `created_at` (timestamptz) - Account creation timestamp

  ### 2. pillars
  - `id` (serial, primary key) - Pillar identifier
  - `pillar_number` (integer, unique) - Pillar sequence number
  - `title` (text) - Pillar title
  - `description` (text) - Detailed description
  - `target_maturity_level` (integer) - Target maturity level for completion
  - `duration` (text) - Expected completion duration
  - `content` (jsonb) - Structured content (objectives, resources, etc.)
  - `created_at` (timestamptz) - Creation timestamp

  ### 3. progress
  - `id` (serial, primary key) - Progress record identifier
  - `user_id` (uuid) - Foreign key to users
  - `pillar_id` (integer) - Foreign key to pillars
  - `status` (text) - Progress status (not_started, in_progress, completed)
  - `completion_percentage` (integer) - Progress percentage (0-100)
  - `last_accessed` (timestamptz) - Last access timestamp
  - `completed_at` (timestamptz) - Completion timestamp

  ### 4. quiz_questions
  - `id` (serial, primary key) - Question identifier
  - `pillar_id` (integer) - Foreign key to pillars
  - `question_number` (integer) - Question sequence number
  - `question_type` (text) - Type (multiple_choice, scenario_based)
  - `category` (text) - Question category
  - `question_text` (text) - Question content
  - `options` (jsonb) - Answer options
  - `correct_answer` (text) - Correct answer identifier
  - `points` (integer) - Points awarded for correct answer
  - `explanation` (text) - Answer explanation
  - `difficulty_level` (text) - Difficulty (beginner, intermediate, advanced)
  - `created_at` (timestamptz) - Creation timestamp

  ### 5. quiz_results
  - `id` (serial, primary key) - Result identifier
  - `user_id` (uuid) - Foreign key to users
  - `pillar_id` (integer) - Foreign key to pillars
  - `score` (integer) - Total score achieved
  - `category_scores` (jsonb) - Scores by category
  - `answers` (jsonb) - Detailed answer breakdown
  - `feedback` (text) - Personalized feedback
  - `passed` (boolean) - Pass/fail status
  - `attempt_number` (integer) - Attempt sequence number
  - `completed_at` (timestamptz) - Completion timestamp

  ### 6. certifications
  - `id` (serial, primary key) - Certification identifier
  - `user_id` (uuid) - Foreign key to users
  - `badge_name` (text) - Certification name
  - `pillar_id` (integer) - Foreign key to pillars
  - `vos_role` (text) - Role certified for
  - `tier` (text) - Certification tier (bronze, silver, gold)
  - `score` (integer) - Certification score (0-100)
  - `awarded_at` (timestamptz) - Award timestamp

  ### 7. maturity_assessments
  - `id` (serial, primary key) - Assessment identifier
  - `user_id` (uuid) - Foreign key to users
  - `level` (integer) - Assessed maturity level
  - `assessment_data` (jsonb) - Detailed assessment data
  - `assessed_at` (timestamptz) - Assessment timestamp

  ### 8. resources
  - `id` (serial, primary key) - Resource identifier
  - `title` (text) - Resource title
  - `resource_type` (text) - Type (template, guide, playbook, etc.)
  - `file_url` (text) - URL to resource file
  - `pillar_id` (integer) - Associated pillar (optional)
  - `vos_role` (text) - Target role (optional)
  - `created_at` (timestamptz) - Creation timestamp

  ### 9. simulation_scenarios
  - `id` (serial, primary key) - Scenario identifier
  - `title` (text) - Scenario title
  - `description` (text) - Detailed description
  - `type` (text) - Simulation type (business_case, qbr_expansion)
  - `difficulty` (text) - Difficulty level
  - `pillar_id` (integer) - Associated pillar (optional)
  - `vos_role` (text) - Target role (optional)
  - `scenario_data` (jsonb) - Structured scenario data
  - `created_at` (timestamptz) - Creation timestamp

  ### 10. simulation_attempts
  - `id` (serial, primary key) - Attempt identifier
  - `user_id` (uuid) - Foreign key to users
  - `scenario_id` (integer) - Foreign key to simulation_scenarios
  - `attempt_number` (integer) - Attempt sequence number
  - `responses_data` (jsonb) - User responses and feedback
  - `overall_score` (integer) - Total score
  - `category_scores` (jsonb) - Scores by category
  - `passed` (boolean) - Pass/fail status
  - `time_spent` (integer) - Time spent in seconds
  - `feedback` (text) - Overall feedback
  - `completed_at` (timestamptz) - Completion timestamp

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Policies restrict users to their own data
  - Public access to curriculum content (pillars, questions, scenarios)
  - Authentication required for all personal data access

  ## Important Notes
  - All user-related tables use UUID for user_id
  - Timestamps use timestamptz for timezone awareness
  - JSON fields use jsonb for better query performance
  - Foreign keys ensure referential integrity
  - Indexes added for frequently queried columns
*/

-- ============================================================================
-- Users Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  open_id text UNIQUE NOT NULL,
  name text,
  email text,
  login_method text,
  role text,
  vos_role text,
  maturity_level integer DEFAULT 1,
  last_signed_in timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own data"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- Pillars Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS pillars (
  id serial PRIMARY KEY,
  pillar_number integer UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  target_maturity_level integer DEFAULT 1,
  duration text,
  content jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE pillars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pillars"
  ON pillars FOR SELECT
  TO public
  USING (true);

-- ============================================================================
-- Progress Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS progress (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pillar_id integer NOT NULL REFERENCES pillars(id) ON DELETE CASCADE,
  status text NOT NULL,
  completion_percentage integer DEFAULT 0,
  last_accessed timestamptz DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(user_id, pillar_id)
);

ALTER TABLE progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own progress"
  ON progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Quiz Questions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS quiz_questions (
  id serial PRIMARY KEY,
  pillar_id integer NOT NULL REFERENCES pillars(id) ON DELETE CASCADE,
  question_number integer NOT NULL,
  question_type text NOT NULL,
  category text,
  question_text text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL,
  points integer DEFAULT 4,
  explanation text,
  difficulty_level text DEFAULT 'intermediate',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read quiz questions"
  ON quiz_questions FOR SELECT
  TO public
  USING (true);

-- ============================================================================
-- Quiz Results Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS quiz_results (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pillar_id integer NOT NULL REFERENCES pillars(id) ON DELETE CASCADE,
  score integer NOT NULL,
  category_scores jsonb,
  answers jsonb,
  feedback text,
  passed boolean DEFAULT false,
  attempt_number integer DEFAULT 1,
  completed_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own quiz results"
  ON quiz_results FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz results"
  ON quiz_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Certifications Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS certifications (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_name text NOT NULL,
  pillar_id integer NOT NULL REFERENCES pillars(id) ON DELETE CASCADE,
  vos_role text NOT NULL,
  tier text DEFAULT 'bronze',
  score integer,
  awarded_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own certifications"
  ON certifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own certifications"
  ON certifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Maturity Assessments Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS maturity_assessments (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level integer NOT NULL,
  assessment_data jsonb,
  assessed_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE maturity_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own assessments"
  ON maturity_assessments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessments"
  ON maturity_assessments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Resources Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS resources (
  id serial PRIMARY KEY,
  title text NOT NULL,
  resource_type text NOT NULL,
  file_url text NOT NULL,
  pillar_id integer REFERENCES pillars(id) ON DELETE SET NULL,
  vos_role text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read resources"
  ON resources FOR SELECT
  TO public
  USING (true);

-- ============================================================================
-- Simulation Scenarios Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS simulation_scenarios (
  id serial PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  type text NOT NULL,
  difficulty text DEFAULT 'intermediate',
  pillar_id integer REFERENCES pillars(id) ON DELETE SET NULL,
  vos_role text,
  scenario_data jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE simulation_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read simulation scenarios"
  ON simulation_scenarios FOR SELECT
  TO public
  USING (true);

-- ============================================================================
-- Simulation Attempts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS simulation_attempts (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id integer NOT NULL REFERENCES simulation_scenarios(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1,
  responses_data jsonb,
  overall_score integer NOT NULL,
  category_scores jsonb,
  passed boolean DEFAULT false,
  time_spent integer,
  feedback text,
  completed_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE simulation_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own simulation attempts"
  ON simulation_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own simulation attempts"
  ON simulation_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_pillar_id ON progress(pillar_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_pillar_id ON quiz_questions(pillar_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_pillar_id ON quiz_results(pillar_id);
CREATE INDEX IF NOT EXISTS idx_certifications_user_id ON certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_maturity_assessments_user_id ON maturity_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_simulation_attempts_user_id ON simulation_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_simulation_attempts_scenario_id ON simulation_attempts(scenario_id);
