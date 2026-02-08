-- No new tables created; no RLS action required in this migration.
-- 2026-02-07: Create docs_embeddings table for docs-reorg tool

-- Ensure vector extension is available
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

CREATE TABLE IF NOT EXISTS public.docs_embeddings (
  path text PRIMARY KEY,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Example index for ivfflat (requires tuning: lists parameter)
-- CREATE INDEX IF NOT EXISTS docs_embeddings_embedding_ivfflat ON public.docs_embeddings USING ivfflat (embedding) WITH (lists = 100);

-- For safety, add a GIN on metadata for queries
CREATE INDEX IF NOT EXISTS docs_embeddings_metadata_gin ON public.docs_embeddings USING gin (metadata);
