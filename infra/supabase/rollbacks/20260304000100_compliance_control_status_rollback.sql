-- Rollback: 20260304000100_compliance_control_status
DROP TABLE IF EXISTS public.compliance_control_audit CASCADE;
DROP TABLE IF EXISTS public.compliance_control_evidence CASCADE;
DROP TABLE IF EXISTS public.compliance_control_status CASCADE;
