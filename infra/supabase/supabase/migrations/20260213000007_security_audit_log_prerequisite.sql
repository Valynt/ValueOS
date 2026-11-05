-- Canonical security-audit table prerequisite. The 20260213000008 migration
-- adds request telemetry columns before the 20260213000010 canonical identity
-- baseline creates this table. Define the exact canonical base shape first.
-- RLS is enabled immediately; canonical policies are installed in 00010.
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid,
  event_type       text        NOT NULL,
  actor            text,
  user_id          uuid,
  action           text,
  table_name       text,
  attempted_action text,
  details          jsonb,
  metadata         jsonb,
  blocked_at       timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
