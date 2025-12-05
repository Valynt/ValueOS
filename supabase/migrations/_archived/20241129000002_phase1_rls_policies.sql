-- Phase 1: Row-Level Security (RLS) Policies
-- Created: 2024-11-29

-- ============================================================================
-- Enable RLS on All Application Tables
-- ============================================================================

ALTER TABLE IF EXISTS cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Cases Table RLS Policies
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own cases" ON cases;
DROP POLICY IF EXISTS "Users can create own cases" ON cases;
DROP POLICY IF EXISTS "Users can update own cases" ON cases;
DROP POLICY IF EXISTS "Users can delete own cases" ON cases;

-- Users can only see their own cases
CREATE POLICY "Users can view own cases"
  ON cases FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create cases for themselves
CREATE POLICY "Users can create own cases"
  ON cases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own cases
CREATE POLICY "Users can update own cases"
  ON cases FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own cases
CREATE POLICY "Users can delete own cases"
  ON cases FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Workflows Table RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own workflows" ON workflows;
DROP POLICY IF EXISTS "Users can create own workflows" ON workflows;
DROP POLICY IF EXISTS "Users can update own workflows" ON workflows;
DROP POLICY IF EXISTS "Users can delete own workflows" ON workflows;

CREATE POLICY "Users can view own workflows"
  ON workflows FOR SELECT
  USING (
    user_id = auth.uid()
    OR case_id IN (
      SELECT id FROM cases WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own workflows"
  ON workflows FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR case_id IN (
      SELECT id FROM cases WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own workflows"
  ON workflows FOR UPDATE
  USING (
    user_id = auth.uid()
    OR case_id IN (
      SELECT id FROM cases WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own workflows"
  ON workflows FOR DELETE
  USING (
    user_id = auth.uid()
    OR case_id IN (
      SELECT id FROM cases WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Messages Table RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can create own messages" ON messages;

CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (
    user_id = auth.uid()
    OR case_id IN (
      SELECT id FROM cases WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own messages"
  ON messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND case_id IN (
      SELECT id FROM cases WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Service Role Bypass (for server-side operations)
-- ============================================================================

-- Allow service role to bypass RLS for all tables
-- This is used by server-side code with service_role key

COMMENT ON TABLE cases IS 'Cases with RLS enabled - users can only access their own data';
COMMENT ON TABLE workflows IS 'Workflows with RLS enabled - users can only access data from their cases';
COMMENT ON TABLE messages IS 'Messages with RLS enabled - users can only access messages from their cases';
