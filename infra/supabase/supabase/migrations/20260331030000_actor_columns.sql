-- Add created_by / updated_by actor columns to mutable tables.
--
-- Without these columns, "who changed this?" requires a join to audit_logs
-- for every query. Adding inline actor traceability to the five tables that
-- agents and users mutate most frequently eliminates that join for the common
-- case and enables efficient per-actor filtering.
--
-- Tables: value_cases, hypothesis_outputs, integrity_outputs,
--         narrative_drafts, realization_reports

SET search_path = public, pg_temp;

-- ============================================================================
-- value_cases
-- ============================================================================

ALTER TABLE public.value_cases
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_value_cases_created_by
  ON public.value_cases (created_by) WHERE created_by IS NOT NULL;

-- ============================================================================
-- hypothesis_outputs
-- ============================================================================

ALTER TABLE public.hypothesis_outputs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hypothesis_outputs_created_by
  ON public.hypothesis_outputs (created_by) WHERE created_by IS NOT NULL;

-- ============================================================================
-- integrity_outputs
-- ============================================================================

ALTER TABLE public.integrity_outputs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_integrity_outputs_created_by
  ON public.integrity_outputs (created_by) WHERE created_by IS NOT NULL;

-- ============================================================================
-- narrative_drafts
-- ============================================================================

ALTER TABLE public.narrative_drafts
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_narrative_drafts_created_by
  ON public.narrative_drafts (created_by) WHERE created_by IS NOT NULL;

-- ============================================================================
-- realization_reports
-- ============================================================================

ALTER TABLE public.realization_reports
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_realization_reports_created_by
  ON public.realization_reports (created_by) WHERE created_by IS NOT NULL;
