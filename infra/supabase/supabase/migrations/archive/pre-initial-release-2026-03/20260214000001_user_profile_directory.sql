-- Canonical user profile directory for admin APIs and tenant user administration.

CREATE TABLE IF NOT EXISTS public.user_profile_directory (
  user_uuid text NOT NULL,
  tenant_id text NOT NULL,
  email text NOT NULL DEFAULT '',
  email_verified boolean NOT NULL DEFAULT false,
  display_name text NOT NULL DEFAULT 'User',
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  creation_source text NOT NULL DEFAULT 'unknown',
  mfa_enrolled boolean NOT NULL DEFAULT false,
  device_count integer NOT NULL DEFAULT 0,
  device_list_reference text NOT NULL DEFAULT 'trusted_devices',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_uuid, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profile_directory_tenant
  ON public.user_profile_directory(tenant_id, display_name);

COMMENT ON TABLE public.user_profile_directory IS
  'Canonical user profile per tenant for admin user listings.';

CREATE OR REPLACE FUNCTION public.refresh_user_profile_directory(
  p_user_id uuid,
  p_tenant_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM public.user_profile_directory upd
  WHERE upd.user_uuid = p_user_id::text
    AND (p_tenant_id IS NULL OR upd.tenant_id = p_tenant_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_tenants ut
      WHERE ut.user_id = upd.user_uuid
        AND ut.tenant_id = upd.tenant_id
    );

  INSERT INTO public.user_profile_directory (
    user_uuid,
    tenant_id,
    email,
    email_verified,
    display_name,
    role,
    status,
    last_login_at,
    creation_source,
    mfa_enrolled,
    device_count,
    device_list_reference,
    updated_at
  )
  SELECT
    ut.user_id,
    ut.tenant_id,
    COALESCE(au.email, ''),
    (au.email_confirmed_at IS NOT NULL),
    COALESCE(
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      split_part(COALESCE(au.email, ''), '@', 1),
      'User'
    ),
    COALESCE(ur.role, ut.role, 'member'),
    COALESCE(NULLIF(ut.status, ''), 'active'),
    au.last_sign_in_at,
    COALESCE(au.raw_app_meta_data->>'provider', 'email'),
    COALESCE(ms.enabled, false),
    COALESCE(td.device_count, 0),
    'trusted_devices',
    now()
  FROM public.user_tenants ut
  LEFT JOIN auth.users au
    ON au.id::text = ut.user_id
  LEFT JOIN LATERAL (
    SELECT ur1.role
    FROM public.user_roles ur1
    WHERE ur1.user_id = ut.user_id
      AND ur1.tenant_id = ut.tenant_id
      AND ur1.role IS NOT NULL
    ORDER BY ur1.created_at DESC
    LIMIT 1
  ) ur ON true
  LEFT JOIN public.mfa_secrets ms
    ON ms.user_id::text = ut.user_id
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS device_count
    FROM public.trusted_devices td1
    WHERE td1.user_id::text = ut.user_id
      AND td1.expires_at > now()
  ) td ON true
  WHERE ut.user_id = p_user_id::text
    AND (p_tenant_id IS NULL OR ut.tenant_id = p_tenant_id)
  ON CONFLICT (user_uuid, tenant_id)
  DO UPDATE SET
    email = excluded.email,
    email_verified = excluded.email_verified,
    display_name = excluded.display_name,
    role = excluded.role,
    status = excluded.status,
    last_login_at = excluded.last_login_at,
    creation_source = excluded.creation_source,
    mfa_enrolled = excluded.mfa_enrolled,
    device_count = excluded.device_count,
    device_list_reference = excluded.device_list_reference,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_user_profile_directory_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_user_id uuid;
  target_tenant_id text;
BEGIN
  target_user_id := COALESCE((NEW.user_id)::uuid, (OLD.user_id)::uuid);

  IF TG_TABLE_NAME = 'user_tenants' OR TG_TABLE_NAME = 'user_roles' THEN
    target_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  END IF;

  PERFORM public.refresh_user_profile_directory(target_user_id, target_tenant_id);
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN others THEN
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_refresh_user_profile_directory_user_tenants ON public.user_tenants;
CREATE TRIGGER trigger_refresh_user_profile_directory_user_tenants
AFTER INSERT OR UPDATE OR DELETE ON public.user_tenants
FOR EACH ROW
EXECUTE FUNCTION public.refresh_user_profile_directory_trigger();

DROP TRIGGER IF EXISTS trigger_refresh_user_profile_directory_user_roles ON public.user_roles;
CREATE TRIGGER trigger_refresh_user_profile_directory_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.refresh_user_profile_directory_trigger();

DROP TRIGGER IF EXISTS trigger_refresh_user_profile_directory_mfa_secrets ON public.mfa_secrets;
CREATE TRIGGER trigger_refresh_user_profile_directory_mfa_secrets
AFTER INSERT OR UPDATE OR DELETE ON public.mfa_secrets
FOR EACH ROW
EXECUTE FUNCTION public.refresh_user_profile_directory_trigger();

DROP TRIGGER IF EXISTS trigger_refresh_user_profile_directory_trusted_devices ON public.trusted_devices;
CREATE TRIGGER trigger_refresh_user_profile_directory_trusted_devices
AFTER INSERT OR UPDATE OR DELETE ON public.trusted_devices
FOR EACH ROW
EXECUTE FUNCTION public.refresh_user_profile_directory_trigger();

CREATE OR REPLACE FUNCTION public.refresh_user_profile_directory_auth_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.refresh_user_profile_directory(COALESCE(NEW.id, OLD.id), NULL);
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN others THEN
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_refresh_user_profile_directory_auth_users ON auth.users;
CREATE TRIGGER trigger_refresh_user_profile_directory_auth_users
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.refresh_user_profile_directory_auth_trigger();

-- Backfill canonical profiles for existing tenant memberships.
DO $$
DECLARE
  row_record record;
BEGIN
  FOR row_record IN
    SELECT DISTINCT ut.user_id
    FROM public.user_tenants ut
    WHERE ut.user_id ~* '^[0-9a-f-]{36}$'
  LOOP
    PERFORM public.refresh_user_profile_directory(row_record.user_id::uuid, NULL);
  END LOOP;
END;
$$;
