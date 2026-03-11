-- Rollback: 20260331040000_semantic_memory_embedding_model.sql

SET search_path = public, pg_temp;

ALTER TABLE public.semantic_memory
  DROP COLUMN IF EXISTS embedding_model;
