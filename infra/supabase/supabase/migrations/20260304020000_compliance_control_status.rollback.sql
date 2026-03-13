-- Rollback: 20260304020000_compliance_control_status
-- Drops compliance_control_status, compliance_control_evidence, compliance_control_audit.

BEGIN;

DROP TABLE IF EXISTS public.compliance_control_audit CASCADE;
DROP TABLE IF EXISTS public.compliance_control_evidence CASCADE;
DROP TABLE IF EXISTS public.compliance_control_status CASCADE;

COMMIT;
