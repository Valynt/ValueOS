-- Create memory_provenance table to explicitly link memory records with their sources

CREATE TABLE IF NOT EXISTS memory_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES agent_memory(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_id UUID,
  evidence jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_provenance_memory_id ON memory_provenance(memory_id);
