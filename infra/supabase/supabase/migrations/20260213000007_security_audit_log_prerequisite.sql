-- The 20260213000008 telemetry column migration depends on
-- security_audit_log, which the canonical identity baseline creates later.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

DO $prereq$
BEGIN
  IF to_regclass('public.security_audit_log') IS NULL THEN
    CREATE TABLE public.security_audit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid,
      event_type text NOT NULL,
      actor text,
      user_id uuid,
      action text,
      table_name text,
      attempted_action text,
      details jsonb,
      metadata jsonb,
      blocked_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    );
    COMMENT ON TABLE public.security_audit_log IS 'valueos-prerequisite:20260213000007';
  END IF;
END $prereq$;

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
