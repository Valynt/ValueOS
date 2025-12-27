-- Add organization_id to semantic_memory table for tenant isolation

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semantic_memory') THEN
    ALTER TABLE semantic_memory
      ADD COLUMN IF NOT EXISTS organization_id UUID;

    CREATE INDEX IF NOT EXISTS idx_semantic_memory_org ON semantic_memory (organization_id);
  END IF;
END
$$;
