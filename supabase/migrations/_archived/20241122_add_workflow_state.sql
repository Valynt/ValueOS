-- ============================================================================
-- Migration: Add Workflow State Support
-- ============================================================================
-- CRITICAL FIX: Adds workflow_state column for stateless orchestration
-- 
-- This migration enables database-backed state persistence to replace
-- the singleton in-memory state that causes cross-contamination.
-- 
-- NOTE: This migration only runs if agent_sessions table already exists
-- ============================================================================

DO $$ 
BEGIN
  -- Only proceed if agent_sessions table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'agent_sessions'
  ) THEN
    -- Add workflow_state column if not exists
    ALTER TABLE agent_sessions 
    ADD COLUMN IF NOT EXISTS workflow_state JSONB;
  ELSE
    RAISE NOTICE 'Skipping migration: agent_sessions table does not exist yet';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'agent_sessions'
  ) THEN
    -- Add comment
    EXECUTE 'COMMENT ON COLUMN agent_sessions.workflow_state IS ''Workflow state stored as JSONB for stateless orchestration''';

    -- Add indexes for faster lookups
    CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id 
    ON agent_sessions(user_id);

    CREATE INDEX IF NOT EXISTS idx_agent_sessions_status 
    ON agent_sessions(status);

    CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated_at 
    ON agent_sessions(updated_at DESC);

    -- Add index on workflow_state for common queries
    CREATE INDEX IF NOT EXISTS idx_agent_sessions_workflow_state_stage 
    ON agent_sessions((workflow_state->>'currentStage'));

    CREATE INDEX IF NOT EXISTS idx_agent_sessions_workflow_state_status 
    ON agent_sessions((workflow_state->>'status'));

    -- Add updated_at trigger if not exists
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $func$ language 'plpgsql';

    DROP TRIGGER IF EXISTS update_agent_sessions_updated_at ON agent_sessions;

    CREATE TRIGGER update_agent_sessions_updated_at 
    BEFORE UPDATE ON agent_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

    -- Add constraint to ensure workflow_state has required fields
    ALTER TABLE agent_sessions
    DROP CONSTRAINT IF EXISTS workflow_state_required_fields;
    
    ALTER TABLE agent_sessions
    ADD CONSTRAINT workflow_state_required_fields
    CHECK (
      workflow_state IS NULL OR (
        workflow_state ? 'currentStage' AND
        workflow_state ? 'status' AND
        workflow_state ? 'completedStages' AND
        workflow_state ? 'context'
      )
    );
  END IF;
END $$;

-- Add function to cleanup old sessions
CREATE OR REPLACE FUNCTION cleanup_old_agent_sessions(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM agent_sessions
  WHERE updated_at < NOW() - (days_old || ' days')::INTERVAL
    AND status != 'active';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_agent_sessions IS 
'Cleanup agent sessions older than specified days (default 30)';

-- Add function to get session statistics
CREATE OR REPLACE FUNCTION get_agent_session_stats(
  start_date TIMESTAMP DEFAULT NOW() - INTERVAL '7 days',
  end_date TIMESTAMP DEFAULT NOW()
)
RETURNS TABLE (
  total_sessions BIGINT,
  active_sessions BIGINT,
  completed_sessions BIGINT,
  error_sessions BIGINT,
  abandoned_sessions BIGINT,
  avg_duration_minutes NUMERIC,
  unique_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_sessions,
    COUNT(*) FILTER (WHERE status = 'active')::BIGINT as active_sessions,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_sessions,
    COUNT(*) FILTER (WHERE status = 'error')::BIGINT as error_sessions,
    COUNT(*) FILTER (WHERE status = 'abandoned')::BIGINT as abandoned_sessions,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60)::NUMERIC(10,2) as avg_duration_minutes,
    COUNT(DISTINCT user_id)::BIGINT as unique_users
  FROM agent_sessions
  WHERE created_at BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_agent_session_stats IS 
'Get statistics for agent sessions within a date range';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'agent_sessions'
  ) THEN
    -- Add RLS policies if not exists
    ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

    -- Policy: Users can only access their own sessions
    DROP POLICY IF EXISTS "Users can access their own sessions" ON agent_sessions;

    CREATE POLICY "Users can access their own sessions"
    ON agent_sessions
    FOR ALL
    USING (auth.uid() = user_id);

    -- Policy: Service role can access all sessions
    DROP POLICY IF EXISTS "Service role can access all sessions" ON agent_sessions;

    CREATE POLICY "Service role can access all sessions"
    ON agent_sessions
    FOR ALL
    TO service_role
    USING (true);
  END IF;
END $$;

-- Add sample workflow state for testing (optional)
-- Uncomment to insert test data
/*
INSERT INTO agent_sessions (user_id, workflow_state, status)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '{
    "currentStage": "discovery",
    "status": "initiated",
    "completedStages": [],
    "context": {
      "conversationHistory": []
    },
    "metadata": {
      "startedAt": "2024-11-22T00:00:00Z",
      "lastUpdatedAt": "2024-11-22T00:00:00Z",
      "errorCount": 0,
      "retryCount": 0
    }
  }'::jsonb,
  'active'
);
*/

-- Verify migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'agent_sessions'
  ) THEN
    -- Check if workflow_state column exists
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'agent_sessions' 
      AND column_name = 'workflow_state'
    ) THEN
      RAISE EXCEPTION 'Migration failed: workflow_state column not created';
    END IF;

    -- Check if indexes exist
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_indexes 
      WHERE tablename = 'agent_sessions' 
      AND indexname = 'idx_agent_sessions_user_id'
    ) THEN
      RAISE EXCEPTION 'Migration failed: idx_agent_sessions_user_id not created';
    END IF;

    RAISE NOTICE 'Migration completed successfully';
  ELSE
    RAISE NOTICE 'Skipped migration: agent_sessions table does not exist';
  END IF;
END $$;
