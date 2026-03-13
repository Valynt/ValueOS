-- DB-level audit coverage for sensitive writes on high-risk tables.
-- Ensures write operations are captured even when API middleware is skipped.

CREATE OR REPLACE FUNCTION public.capture_sensitive_write_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  action_text text;
  tenant_ref uuid;
  org_ref uuid;
  actor_id uuid;
  actor_email text;
BEGIN
  action_text := CASE TG_OP
    WHEN 'INSERT' THEN 'data.create'
    WHEN 'UPDATE' THEN 'data.update'
    WHEN 'DELETE' THEN 'data.delete'
    ELSE 'data.update'
  END;

  -- Derive tenant / organization reference per table schema.
  IF TG_TABLE_NAME = 'memberships' THEN
    -- memberships uses tenant_id (TEXT) instead of organization_id (UUID).
    BEGIN
      tenant_ref := COALESCE(
        NULLIF(NEW.tenant_id, '')::uuid,
        NULLIF(OLD.tenant_id, '')::uuid
      );
    EXCEPTION
      WHEN invalid_text_representation THEN
        -- If tenant_id is not a valid UUID, avoid failing the write; record audit without tenant linkage.
        tenant_ref := NULL;
    END;
    org_ref := tenant_ref;
  ELSE
    -- Default path for tables that use organization_id (UUID).
    tenant_ref := COALESCE(NEW.organization_id, OLD.organization_id);
    org_ref := COALESCE(NEW.organization_id, OLD.organization_id);
  END IF;

  actor_id := auth.uid();
  actor_email := COALESCE((auth.jwt() ->> 'email'), 'system@internal');

  INSERT INTO public.audit_logs (
    tenant_id,
    organization_id,
    user_id,
    user_name,
    user_email,
    action,
    resource_type,
    resource_id,
    details,
    status,
    timestamp
  )
  VALUES (
    tenant_ref,
    org_ref,
    actor_id,
    COALESCE(actor_email, 'system'),
    actor_email,
    action_text,
    TG_TABLE_NAME,
    COALESCE((NEW.id)::text, (OLD.id)::text, 'unknown'),
    jsonb_build_object(
      'source', 'db_trigger',
      'operation', TG_OP,
      'table', TG_TABLE_NAME
    ),
    'success',
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS memberships_sensitive_write_audit ON public.memberships;
CREATE TRIGGER memberships_sensitive_write_audit
AFTER INSERT OR UPDATE OR DELETE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.capture_sensitive_write_audit();

DROP TRIGGER IF EXISTS value_cases_sensitive_write_audit ON public.value_cases;
CREATE TRIGGER value_cases_sensitive_write_audit
AFTER INSERT OR UPDATE OR DELETE ON public.value_cases
FOR EACH ROW EXECUTE FUNCTION public.capture_sensitive_write_audit();
