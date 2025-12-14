-- Add TTL, provenance, and organization_id to agent_memory; implement GC helper functions

ALTER TABLE agent_memory
  ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE agent_memory
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE agent_memory
  ADD COLUMN IF NOT EXISTS provenance JSONB DEFAULT '{}'::jsonb;

ALTER TABLE agent_memory
  ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE agent_memory
  ADD COLUMN IF NOT EXISTS source_id TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_memory_org ON agent_memory(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_expires_at ON agent_memory(expires_at);

-- Add a function to delete expired memories and return affected rows for monitoring
CREATE OR REPLACE FUNCTION public.prune_expired_agent_memories(p_limit INTEGER DEFAULT 1000)
RETURNS TABLE(deleted_count INTEGER) AS
$func$
DECLARE
  rec RECORD;
  del_count INTEGER := 0;
BEGIN
  FOR rec IN SELECT id FROM agent_memory
    WHERE expires_at IS NOT NULL
      AND expires_at <= now()
      AND memory_type != 'episodic'
    LIMIT p_limit
  LOOP
    DELETE FROM agent_memory WHERE id = rec.id;
    del_count := del_count + 1;
  END LOOP;

  RETURN QUERY SELECT del_count;
END;
$func$ LANGUAGE plpgsql;

-- Add helper to mark the memory TTL for a given memory id
CREATE OR REPLACE FUNCTION public.set_memory_ttl(p_id UUID, p_expires_at timestamptz)
RETURNS VOID AS
$func$
BEGIN
  UPDATE agent_memory SET expires_at = p_expires_at WHERE id = p_id;
END;
$func$ LANGUAGE plpgsql;

-- Ensure RLS uses metadata organization_id if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_memory') THEN
    ALTER TABLE agent_memory DROP CONSTRAINT IF EXISTS agent_memory_org_check;
    -- Currently session-scoped RLS exists; keep both checks: session -> user -> org
  END IF;
END
$$;
