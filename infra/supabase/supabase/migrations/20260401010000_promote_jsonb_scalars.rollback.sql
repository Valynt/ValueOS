-- Rollback: 20260401010000_promote_jsonb_scalars.sql

SET search_path = public, pg_temp;

ALTER TABLE public.realization_reports
  DROP COLUMN IF EXISTS kpi_count,
  DROP COLUMN IF EXISTS milestone_count,
  DROP COLUMN IF EXISTS risk_count,
  DROP COLUMN IF EXISTS overall_realization_rate;

ALTER TABLE public.integrity_outputs
  DROP COLUMN IF EXISTS claim_count,
  DROP COLUMN IF EXISTS flagged_claim_count;
