-- ============================================================================
-- ROLLBACK: 20260304020000_compliance_control_status
-- Drops compliance control tables and their immutability triggers.
-- ⚠️  All compliance evidence and audit records will be lost.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

-- CASCADE removes triggers, policies, and indexes
DROP TABLE IF EXISTS public.compliance_control_audit CASCADE;
DROP TABLE IF EXISTS public.compliance_control_evidence CASCADE;
DROP TABLE IF EXISTS public.compliance_control_status CASCADE;
