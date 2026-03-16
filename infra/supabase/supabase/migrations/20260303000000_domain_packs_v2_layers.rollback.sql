-- Rollback: 20260303000000_domain_packs_v2_layers
-- Removes overlay columns added to domain_packs.

BEGIN;

ALTER TABLE public.domain_packs
  DROP COLUMN IF EXISTS slug,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS benchmarks,
  DROP COLUMN IF EXISTS risk_weights,
  DROP COLUMN IF EXISTS compliance_rules,
  DROP COLUMN IF EXISTS narrative_templates,
  DROP COLUMN IF EXISTS glossary;

COMMIT;
