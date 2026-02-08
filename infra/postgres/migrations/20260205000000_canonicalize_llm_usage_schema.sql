-- No new tables created; no RLS action required in this migration.
-- Canonicalize llm_usage schema for production tracker writes.
-- Canonical columns:
--   tenant_id, created_at, input_tokens, output_tokens, total_tokens, cost

BEGIN;

ALTER TABLE public.llm_usage
  ADD COLUMN IF NOT EXISTS input_tokens integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS cost numeric(10,6),
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'llm_usage' AND column_name = 'prompt_tokens'
  ) THEN
    EXECUTE '
      UPDATE public.llm_usage
      SET input_tokens = COALESCE(input_tokens, prompt_tokens)
      WHERE input_tokens IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'llm_usage' AND column_name = 'completion_tokens'
  ) THEN
    EXECUTE '
      UPDATE public.llm_usage
      SET output_tokens = COALESCE(output_tokens, completion_tokens)
      WHERE output_tokens IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'llm_usage' AND column_name = 'estimated_cost'
  ) THEN
    EXECUTE '
      UPDATE public.llm_usage
      SET cost = COALESCE(cost, estimated_cost)
      WHERE cost IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'llm_usage' AND column_name = 'timestamp'
  ) THEN
    EXECUTE '
      UPDATE public.llm_usage
      SET created_at = COALESCE(created_at, "timestamp")
      WHERE created_at IS NULL';
  END IF;
END $$;

UPDATE public.llm_usage
SET total_tokens = COALESCE(total_tokens, COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0))
WHERE total_tokens IS NULL;

CREATE OR REPLACE VIEW public.llm_usage_legacy_compat AS
SELECT
  id,
  tenant_id,
  user_id,
  session_id,
  model,
  input_tokens AS prompt_tokens,
  output_tokens AS completion_tokens,
  total_tokens,
  cost AS estimated_cost,
  created_at AS "timestamp",
  created_at
FROM public.llm_usage;

COMMIT;
