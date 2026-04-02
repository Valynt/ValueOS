-- Rollback: 20260927000002_realizing_lifecycle_stage
-- Removes the stage CHECK constraints added by the forward migration.
-- Does NOT remove 'realizing' rows — callers must handle that before rolling back.

BEGIN;

ALTER TABLE public.value_cases
    DROP CONSTRAINT IF EXISTS value_cases_stage_check;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'opportunities'
          AND column_name  = 'lifecycle_stage'
    ) THEN
        ALTER TABLE public.opportunities
            DROP CONSTRAINT IF EXISTS opportunities_lifecycle_stage_check;
    END IF;
END;
$$;

COMMIT;
