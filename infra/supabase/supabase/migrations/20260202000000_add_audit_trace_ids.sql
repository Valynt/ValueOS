-- No new tables created; no RLS action required in this migration.
-- Add trace/request correlation fields to audit logs

BEGIN;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS trace_id text NOT NULL DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS request_id text;

ALTER TABLE public.audit_logs_archive
  ADD COLUMN IF NOT EXISTS trace_id text NOT NULL DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS request_id text;

CREATE INDEX IF NOT EXISTS idx_audit_logs_trace_id ON public.audit_logs (trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON public.audit_logs (request_id);

CREATE OR REPLACE FUNCTION public.append_audit_log(
  p_user_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_old_values jsonb DEFAULT NULL::jsonb,
  p_new_values jsonb DEFAULT NULL::jsonb,
  p_metadata jsonb DEFAULT NULL::jsonb
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  log_id UUID;
  client_ip TEXT;
  client_ua TEXT;
  header_json JSON;
  trace_id TEXT;
  request_id TEXT;
BEGIN
  -- Get client info from current request context (if available)
  BEGIN
    header_json := current_setting('request.headers', true)::json;
    client_ip := header_json->>'x-forwarded-for';
    client_ua := header_json->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    client_ip := NULL;
    client_ua := NULL;
  END;

  trace_id := COALESCE(
    NULLIF(p_metadata->>'trace_id', ''),
    NULLIF(header_json->>'x-trace-id', ''),
    NULLIF(header_json->>'traceparent', ''),
    NULLIF(current_setting('app.trace_id', true), ''),
    gen_random_uuid()::text
  );

  request_id := COALESCE(
    NULLIF(p_metadata->>'request_id', ''),
    NULLIF(header_json->>'x-request-id', ''),
    NULLIF(header_json->>'x-correlation-id', ''),
    NULLIF(current_setting('app.request_id', true), '')
  );

  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    old_values,
    new_values,
    metadata,
    trace_id,
    request_id
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    client_ip::inet,
    client_ua,
    p_old_values,
    p_new_values,
    p_metadata,
    trace_id,
    request_id
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  org_id uuid;
  user_id uuid;
  has_org boolean;
  header_json JSON;
  trace_id TEXT;
  request_id TEXT;
BEGIN
  BEGIN
    header_json := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    header_json := NULL;
  END;

  trace_id := COALESCE(
    NULLIF(header_json->>'x-trace-id', ''),
    NULLIF(header_json->>'traceparent', ''),
    NULLIF(current_setting('app.trace_id', true), ''),
    gen_random_uuid()::text
  );

  request_id := COALESCE(
    NULLIF(header_json->>'x-request-id', ''),
    NULLIF(header_json->>'x-correlation-id', ''),
    NULLIF(current_setting('app.request_id', true), '')
  );

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'organization_id'
  ) INTO has_org;

  IF has_org THEN
    IF TG_OP = 'DELETE' THEN
      org_id := OLD.organization_id;
    ELSE
      org_id := NEW.organization_id;
    END IF;
  ELSE
    org_id := (SELECT public.get_current_org_id());
  END IF;

  user_id := (SELECT public.get_current_user_id());

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      organization_id,
      user_id,
      action,
      resource_type,
      resource_id,
      changes,
      trace_id,
      request_id
    )
      VALUES (
        org_id,
        user_id,
        'delete',
        TG_TABLE_NAME,
        OLD.id,
        jsonb_build_object('before', row_to_json(OLD)),
        trace_id,
        request_id
      );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      organization_id,
      user_id,
      action,
      resource_type,
      resource_id,
      changes,
      trace_id,
      request_id
    )
      VALUES (
        org_id,
        user_id,
        'update',
        TG_TABLE_NAME,
        NEW.id,
        jsonb_build_object('before', row_to_json(OLD), 'after', row_to_json(NEW)),
        trace_id,
        request_id
      );
  ELSE
    INSERT INTO public.audit_logs (
      organization_id,
      user_id,
      action,
      resource_type,
      resource_id,
      changes,
      trace_id,
      request_id
    )
      VALUES (
        org_id,
        user_id,
        'create',
        TG_TABLE_NAME,
        NEW.id,
        jsonb_build_object('after', row_to_json(NEW)),
        trace_id,
        request_id
      );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMIT;
