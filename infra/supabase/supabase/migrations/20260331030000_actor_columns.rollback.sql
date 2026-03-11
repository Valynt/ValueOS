-- Rollback: 20260331030000_actor_columns.sql

SET search_path = public, pg_temp;

ALTER TABLE public.realization_reports
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by;

ALTER TABLE public.narrative_drafts
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by;

ALTER TABLE public.integrity_outputs
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by;

ALTER TABLE public.hypothesis_outputs
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by;

ALTER TABLE public.value_cases
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by;
