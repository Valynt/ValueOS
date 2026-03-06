-- Rollback: 20260303000100_domain_packs_v2_layers
-- Removes the overlay layer columns added to domain_packs.
ALTER TABLE public.domain_packs
  DROP COLUMN IF EXISTS glossary,
  DROP COLUMN IF EXISTS narrative_templates,
  DROP COLUMN IF EXISTS compliance_rules,
  DROP COLUMN IF EXISTS risk_weights,
  DROP COLUMN IF EXISTS benchmarks,
  DROP COLUMN IF EXISTS description;
