-- =============================================================================
-- realizing lifecycle stage
--
-- Adds 'realizing' as a first-class lifecycle stage between 'refining' and
-- 'realized'. The spec (§2) separates Review & Approval (refining) from
-- active post-sale tracking (realizing). Previously RealizationAgent mapped
-- to 'refining', conflating approval with delivery tracking.
--
-- Changes:
--   1. Adds a CHECK constraint on value_cases.stage enforcing the canonical
--      8-stage vocabulary (previously unconstrained).
--   2. Adds the same constraint on opportunities.lifecycle_stage if that
--      column exists (forward-compatible — no-op if absent).
--
-- TypeScript changes (same commit):
--   - OpportunityLifecycleStageSchema in packages/shared/src/domain/Opportunity.ts
--   - AGENT_LABEL_TO_LIFECYCLE_STAGE / LIFECYCLE_STAGE_TO_AGENT_LABEL in lifecycleStageAdapter.ts
--   - SagaLifecycleState in ValueLifecycleOrchestrator.ts
--   - stageContext in AgentChatService.ts
--   - LIFECYCLE_STAGES in WorkflowLifecycleIntegration.ts
--
-- Spec reference: ValueOS Consolidated Spec §2 (REALIZING workflow state)
-- =============================================================================

SET search_path = public, pg_temp;

BEGIN;

-- ── value_cases.stage ────────────────────────────────────────────────────────
-- Add a CHECK constraint enforcing the canonical stage vocabulary.
-- Any existing rows with non-canonical stage values will cause this to fail —
-- run the data audit query below first if applying to a populated environment:
--
--   SELECT DISTINCT stage FROM public.value_cases
--   WHERE stage NOT IN (
--     'discovery','drafting','validating','composing',
--     'refining','realizing','realized','expansion'
--   );

ALTER TABLE public.value_cases
    DROP CONSTRAINT IF EXISTS value_cases_stage_check;

ALTER TABLE public.value_cases
    ADD CONSTRAINT value_cases_stage_check
    CHECK (stage IN (
        'discovery',
        'drafting',
        'validating',
        'composing',
        'refining',
        'realizing',
        'realized',
        'expansion'
    ));

-- ── opportunities.lifecycle_stage (forward-compatible) ───────────────────────
-- The opportunities table may not exist yet in all environments. This block
-- is intentionally wrapped so the migration succeeds either way.

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

        ALTER TABLE public.opportunities
            ADD CONSTRAINT opportunities_lifecycle_stage_check
            CHECK (lifecycle_stage IN (
                'discovery',
                'drafting',
                'validating',
                'composing',
                'refining',
                'realizing',
                'realized',
                'expansion'
            ));
    END IF;
END;
$$;

COMMIT;
