-- Compliance control status and immutable evidence trail

CREATE TABLE IF NOT EXISTS public.compliance_control_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id text NOT NULL,
  framework text NOT NULL,
  status text NOT NULL CHECK (status IN ('pass', 'warn', 'fail')),
  evidence_ts timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL,
  evidence_pointer text NOT NULL,
  metric_value numeric(10,2) NOT NULL,
  metric_unit text NOT NULL CHECK (metric_unit IN ('percent', 'hours', 'count')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compliance_control_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  control_id text NOT NULL,
  framework text NOT NULL,
  evidence_pointer text NOT NULL,
  evidence_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_ts timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compliance_control_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  control_id text NOT NULL,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_ts timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_control_status_tenant_control
  ON public.compliance_control_status (tenant_id, control_id, evidence_ts DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_control_evidence_tenant_control
  ON public.compliance_control_evidence (tenant_id, control_id, evidence_ts DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_control_audit_tenant_control
  ON public.compliance_control_audit (tenant_id, control_id, evidence_ts DESC);

ALTER TABLE public.compliance_control_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_control_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_control_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_control_status_tenant_select ON public.compliance_control_status;
CREATE POLICY compliance_control_status_tenant_select ON public.compliance_control_status
  FOR SELECT TO authenticated
  USING (tenant_id::text = COALESCE(current_setting('app.current_tenant_id', true), current_setting('request.jwt.claim.tenant_id', true), current_setting('request.jwt.claim.organization_id', true)));

DROP POLICY IF EXISTS compliance_control_status_tenant_insert ON public.compliance_control_status;
CREATE POLICY compliance_control_status_tenant_insert ON public.compliance_control_status
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id::text = COALESCE(current_setting('app.current_tenant_id', true), current_setting('request.jwt.claim.tenant_id', true), current_setting('request.jwt.claim.organization_id', true)));

DROP POLICY IF EXISTS compliance_control_evidence_tenant_select ON public.compliance_control_evidence;
CREATE POLICY compliance_control_evidence_tenant_select ON public.compliance_control_evidence
  FOR SELECT TO authenticated
  USING (tenant_id::text = COALESCE(current_setting('app.current_tenant_id', true), current_setting('request.jwt.claim.tenant_id', true), current_setting('request.jwt.claim.organization_id', true)));

DROP POLICY IF EXISTS compliance_control_evidence_tenant_insert ON public.compliance_control_evidence;
CREATE POLICY compliance_control_evidence_tenant_insert ON public.compliance_control_evidence
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id::text = COALESCE(current_setting('app.current_tenant_id', true), current_setting('request.jwt.claim.tenant_id', true), current_setting('request.jwt.claim.organization_id', true)));

DROP POLICY IF EXISTS compliance_control_audit_tenant_select ON public.compliance_control_audit;
CREATE POLICY compliance_control_audit_tenant_select ON public.compliance_control_audit
  FOR SELECT TO authenticated
  USING (tenant_id::text = COALESCE(current_setting('app.current_tenant_id', true), current_setting('request.jwt.claim.tenant_id', true), current_setting('request.jwt.claim.organization_id', true)));

DROP POLICY IF EXISTS compliance_control_audit_tenant_insert ON public.compliance_control_audit;
CREATE POLICY compliance_control_audit_tenant_insert ON public.compliance_control_audit
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id::text = COALESCE(current_setting('app.current_tenant_id', true), current_setting('request.jwt.claim.tenant_id', true), current_setting('request.jwt.claim.organization_id', true)));

CREATE OR REPLACE FUNCTION public.prevent_compliance_control_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Compliance control evidence is immutable';
END;
$$;

DROP TRIGGER IF EXISTS prevent_compliance_control_status_update ON public.compliance_control_status;
CREATE TRIGGER prevent_compliance_control_status_update
  BEFORE UPDATE OR DELETE ON public.compliance_control_status
  FOR EACH ROW EXECUTE FUNCTION public.prevent_compliance_control_mutation();

DROP TRIGGER IF EXISTS prevent_compliance_control_evidence_update ON public.compliance_control_evidence;
CREATE TRIGGER prevent_compliance_control_evidence_update
  BEFORE UPDATE OR DELETE ON public.compliance_control_evidence
  FOR EACH ROW EXECUTE FUNCTION public.prevent_compliance_control_mutation();

DROP TRIGGER IF EXISTS prevent_compliance_control_audit_update ON public.compliance_control_audit;
CREATE TRIGGER prevent_compliance_control_audit_update
  BEFORE UPDATE OR DELETE ON public.compliance_control_audit
  FOR EACH ROW EXECUTE FUNCTION public.prevent_compliance_control_mutation();

GRANT SELECT, INSERT ON public.compliance_control_status TO authenticated;
GRANT SELECT, INSERT ON public.compliance_control_evidence TO authenticated;
GRANT SELECT, INSERT ON public.compliance_control_audit TO authenticated;
GRANT ALL ON public.compliance_control_status TO service_role;
GRANT ALL ON public.compliance_control_evidence TO service_role;
GRANT ALL ON public.compliance_control_audit TO service_role;
