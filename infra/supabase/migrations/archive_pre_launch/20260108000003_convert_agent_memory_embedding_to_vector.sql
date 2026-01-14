-- Convert agent_memory.embedding from text to vector type
-- This fixes critical vector database functionality for semantic search and embeddings

BEGIN;

-- Install the pgvector extension if not already installed
CREATE EXTENSION IF NOT EXISTS vector;

-- Add a temporary column for the vector data
ALTER TABLE public.agent_memory ADD COLUMN embedding_vector vector(1536);

-- Convert existing text embeddings to vector type
-- Assuming embeddings are stored as comma-separated numbers
UPDATE public.agent_memory
SET embedding_vector = CASE
    WHEN embedding IS NOT NULL AND embedding != ''
    THEN embedding::vector(1536)
    ELSE NULL
END;

-- Drop the old text column
ALTER TABLE public.agent_memory DROP COLUMN IF EXISTS embedding;

-- Rename the vector column to the standard name
ALTER TABLE public.agent_memory RENAME COLUMN embedding_vector TO embedding;

-- Add index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding ON public.agent_memory USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add check constraint to ensure embedding is not null for valid records
ALTER TABLE public.agent_memory ADD CONSTRAINT chk_agent_memory_embedding_not_empty
CHECK (embedding IS NOT NULL OR content IS NULL);

-- Add index for memory type for better query performance
CREATE INDEX IF NOT EXISTS idx_agent_memory_memory_type ON public.agent_memory USING btree (memory_type);

-- Add index for tenant_id for tenant isolation
CREATE INDEX IF NOT EXISTS idx_agent_memory_tenant_id ON public.agent_memory USING btree (tenant_id);

COMMIT;