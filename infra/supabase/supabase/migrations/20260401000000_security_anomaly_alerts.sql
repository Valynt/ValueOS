SET search_path = public, pg_temp;

CREATE TABLE IF NOT EXISTS public.security_anomaly_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  anomaly_type text NOT NULL CHECK (anomaly_type IN (
    'bulk_export_volume',
    'off_hours_privileged_access',
    'repeated_failed_access',
    'api_burst'
  )),
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  actor_id text,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  observed_value integer NOT NULL,
  threshold_value integer NOT NULL,
  evidence_event_ids text[] NOT NULL DEFAULT '{}',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','suppressed')),
  acknowledged_at timestamptz,
  acknowledged_by text,
  acknowledge_reason text,
  suppression_until timestamptz,
  suppression_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_anomaly_alerts_tenant_created
  ON public.security_anomaly_alerts (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_anomaly_alerts_tenant_status
  ON public.security_anomaly_alerts (tenant_id, status);

-- Enable row level security for tenant-scoped access control
ALTER TABLE public.security_anomaly_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: tenants can select only their own security anomaly alerts
CREATE POLICY security_anomaly_alerts_select_tenant
  ON public.security_anomaly_alerts
  FOR SELECT
  USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

-- Policy: tenants can insert alerts only for their own tenant_id
CREATE POLICY security_anomaly_alerts_insert_tenant
  ON public.security_anomaly_alerts
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

-- Policy: tenants can update only alerts belonging to their tenant_id
CREATE POLICY security_anomaly_alerts_update_tenant
  ON public.security_anomaly_alerts
  FOR UPDATE
  USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

-- Explicit privileges: lock down PUBLIC, grant to authenticated and service_role
REVOKE ALL ON TABLE public.security_anomaly_alerts FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.security_anomaly_alerts TO authenticated;
GRANT ALL ON TABLE public.security_anomaly_alerts TO service_role;

CREATE TABLE IF NOT EXISTS public.security_anomaly_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  anomaly_type text NOT NULL CHECK (anomaly_type IN (
    'bulk_export_volume',
    'off_hours_privileged_access',
    'repeated_failed_access',
    'api_burst'
  )),
  actor_id text,
  suppression_until timestamptz NOT NULL,
  reason text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_anomaly_suppressions_lookup
  ON public.security_anomaly_suppressions (tenant_id, anomaly_type, actor_id, suppression_until DESC);

-- Enable row level security for tenant-scoped access control
ALTER TABLE public.security_anomaly_suppressions ENABLE ROW LEVEL SECURITY;

-- Policy: tenants can select only their own anomaly suppressions
CREATE POLICY security_anomaly_suppressions_select_tenant
  ON public.security_anomaly_suppressions
  FOR SELECT
  USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

-- Policy: tenants can insert suppressions only for their own tenant_id
CREATE POLICY security_anomaly_suppressions_insert_tenant
  ON public.security_anomaly_suppressions
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

-- Policy: tenants can update only suppressions belonging to their tenant_id
CREATE POLICY security_anomaly_suppressions_update_tenant
  ON public.security_anomaly_suppressions
  FOR UPDATE
  USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

-- Explicit privileges: lock down PUBLIC, grant to authenticated and service_role
REVOKE ALL ON TABLE public.security_anomaly_suppressions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.security_anomaly_suppressions TO authenticated;
GRANT ALL ON TABLE public.security_anomaly_suppressions TO service_role;
