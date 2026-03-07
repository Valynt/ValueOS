-- ============================================================================
-- ROLLBACK: 20260303000000_domain_packs_v2_layers
-- Removes overlay layer columns and slug added to domain_packs.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.domain_packs
    DROP COLUMN IF EXISTS glossary,
    DROP COLUMN IF EXISTS narrative_templates,
    DROP COLUMN IF EXISTS compliance_rules,
    DROP COLUMN IF EXISTS risk_weights,
    DROP COLUMN IF EXISTS benchmarks,
    DROP COLUMN IF EXISTS description,
    DROP COLUMN IF EXISTS slug;

DROP INDEX IF EXISTS public.idx_domain_packs_slug;
