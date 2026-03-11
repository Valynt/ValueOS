-- Promote queryable scalar fields from jsonb arrays to typed columns.
--
-- Without these columns, aggregation queries (e.g. "average confidence across
-- all integrity checks for an org") require application-layer jsonb parsing.
-- Promoting the scalar fields makes them indexable and directly aggregatable.
--
-- integrity_outputs:
--   claim_count          — length of claims[] array
--   flagged_claim_count  — count of claims where flagged = true
--   (overall_confidence and veto_triggered are already typed columns)
--
-- realization_reports:
--   kpi_count            — length of kpis[] array
--   milestone_count      — length of milestones[] array
--   risk_count           — length of risks[] array
--   overall_realization_rate — top-level confidence scalar (was buried in
--                              variance_analysis jsonb or derived at read time)
--
-- narrative_drafts: defense_readiness_score is already a typed column; no
-- additional promotion needed.
--
-- Existing rows are backfilled using jsonb_array_length() and jsonb extraction.
-- New rows should populate these columns at insert time (application layer).

SET search_path = public, pg_temp;

-- ============================================================================
-- integrity_outputs
-- ============================================================================

ALTER TABLE public.integrity_outputs
  ADD COLUMN IF NOT EXISTS claim_count         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flagged_claim_count integer NOT NULL DEFAULT 0;

-- Backfill from existing jsonb data
UPDATE public.integrity_outputs
SET
  claim_count         = jsonb_array_length(claims),
  flagged_claim_count = (
    SELECT COUNT(*)::integer
    FROM jsonb_array_elements(claims) AS c
    WHERE (c->>'flagged')::boolean = true
  )
WHERE claims IS NOT NULL AND jsonb_array_length(claims) > 0;

CREATE INDEX IF NOT EXISTS idx_integrity_outputs_flagged_count
  ON public.integrity_outputs (organization_id, flagged_claim_count DESC)
  WHERE flagged_claim_count > 0;

CREATE INDEX IF NOT EXISTS idx_integrity_outputs_confidence
  ON public.integrity_outputs (organization_id, overall_confidence DESC)
  WHERE overall_confidence IS NOT NULL;

-- ============================================================================
-- realization_reports
-- ============================================================================

ALTER TABLE public.realization_reports
  ADD COLUMN IF NOT EXISTS kpi_count               integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS milestone_count         integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_count              integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overall_realization_rate numeric(4,3)
    CHECK (overall_realization_rate >= 0 AND overall_realization_rate <= 1);

-- Backfill counts from existing jsonb arrays
UPDATE public.realization_reports
SET
  kpi_count       = jsonb_array_length(kpis),
  milestone_count = jsonb_array_length(milestones),
  risk_count      = jsonb_array_length(risks);

-- Backfill overall_realization_rate from variance_analysis if present
-- RealizationAgent stores it as variance_analysis->>'overall_realization_rate'
UPDATE public.realization_reports
SET overall_realization_rate = (
  variance_analysis->>'overall_realization_rate'
)::numeric
WHERE variance_analysis ? 'overall_realization_rate'
  AND (variance_analysis->>'overall_realization_rate') ~ '^[0-9.]+$';

CREATE INDEX IF NOT EXISTS idx_realization_reports_realization_rate
  ON public.realization_reports (organization_id, overall_realization_rate DESC)
  WHERE overall_realization_rate IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_realization_reports_risk_count
  ON public.realization_reports (organization_id, risk_count DESC)
  WHERE risk_count > 0;
