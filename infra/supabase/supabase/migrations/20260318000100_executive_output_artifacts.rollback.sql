-- ============================================================================
-- Executive Output Generation — Case Artifacts and Edit Tracking (Rollback)
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS public.artifact_edits;
DROP TABLE IF EXISTS public.case_artifacts;

COMMIT;
