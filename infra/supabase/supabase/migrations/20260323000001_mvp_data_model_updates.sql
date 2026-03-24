-- Migration: MVP Data Model Updates
-- Task 0: Schema validation and updates for critical path
-- 
-- Changes:
-- 1. assumptions table: change value to text, add version, sensitivity_low/high
-- 2. business_cases table: add integrity_check_passed, integrity_evaluated_at, veto_reason
-- 3. hypothesis_outputs table: add financial_summary jsonb

-- ============================================
-- 1. ASSUMPTIONS TABLE UPDATES
-- ============================================

-- Add new columns for Decimal precision and version tracking
ALTER TABLE assumptions 
  ADD COLUMN IF NOT EXISTS value_text TEXT,
  ADD COLUMN IF NOT EXISTS sensitivity_low TEXT,
  ADD COLUMN IF NOT EXISTS sensitivity_high TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Migrate existing numeric values to text (preserve precision)
UPDATE assumptions SET value_text = value::TEXT WHERE value_text IS NULL;

-- Make value_text required after migration
ALTER TABLE assumptions ALTER COLUMN value_text SET NOT NULL;

-- Add comments
COMMENT ON COLUMN assumptions.value_text IS 'Decimal value stored as string to preserve precision';
COMMENT ON COLUMN assumptions.sensitivity_low IS 'Lower bound multiplier as string (e.g., "0.8" for -20%)';
COMMENT ON COLUMN assumptions.sensitivity_high IS 'Upper bound multiplier as string (e.g., "1.2" for +20%)';
COMMENT ON COLUMN assumptions.version IS 'Incremented on each assumption edit for audit trail';

-- ============================================
-- 2. BUSINESS_CASES TABLE UPDATES  
-- ============================================

ALTER TABLE business_cases
  ADD COLUMN IF NOT EXISTS integrity_check_passed BOOLEAN,
  ADD COLUMN IF NOT EXISTS integrity_evaluated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS veto_reason TEXT;

COMMENT ON COLUMN business_cases.integrity_check_passed IS 'TRUE if integrity_score >= 0.6 and no critical violations';
COMMENT ON COLUMN business_cases.integrity_evaluated_at IS 'When integrity was last evaluated (audit trail)';
COMMENT ON COLUMN business_cases.veto_reason IS 'Reason for veto if integrity_check_passed is false';

-- ============================================
-- 3. HYPOTHESIS_OUTPUTS TABLE UPDATES
-- ============================================

ALTER TABLE hypothesis_outputs
  ADD COLUMN IF NOT EXISTS financial_summary JSONB;

COMMENT ON COLUMN hypothesis_outputs.financial_summary IS 
'JSON: {npv, irr, roi, payback_months, scenarios: {conservative, base, upside}}. Monetary values as strings for Decimal precision.';

-- ============================================
-- INDEXES FOR MVP QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_business_cases_integrity_check 
  ON business_cases(organization_id, integrity_check_passed, integrity_score)
  WHERE integrity_check_passed = false OR integrity_score < 0.6;

CREATE INDEX IF NOT EXISTS idx_business_cases_opportunity_integrity 
  ON business_cases(opportunity_id, integrity_check_passed, integrity_score);

CREATE INDEX IF NOT EXISTS idx_assumptions_opportunity_version 
  ON assumptions(opportunity_id, hypothesis_id, version DESC);
