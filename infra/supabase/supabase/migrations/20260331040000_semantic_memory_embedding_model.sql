-- Add embedding_model column to semantic_memory.
--
-- Without this column there is no way to filter or invalidate stale vectors
-- when the embedding model changes — a full table scan would be required.
-- Adding it now, before the table grows large, allows targeted re-embedding
-- of rows produced by a specific model version.

SET search_path = public, pg_temp;

ALTER TABLE public.semantic_memory
  ADD COLUMN IF NOT EXISTS embedding_model text NOT NULL DEFAULT 'text-embedding-ada-002';

-- Index enables efficient filtering when re-embedding after a model change.
CREATE INDEX IF NOT EXISTS idx_semantic_memory_embedding_model
  ON public.semantic_memory (embedding_model);
