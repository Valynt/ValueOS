-- ============================================================================
-- Migration: user_tenants FK + get_refresh_token_status RPC
--
-- 1. Adds missing FK from user_tenants.tenant_id -> tenants.id so PostgREST
--    can resolve the tenants:tenant_id(...) join used by the frontend.
-- 2. Creates the get_refresh_token_status RPC called by SecureTokenManager
--    for refresh-token replay detection.
-- ============================================================================

BEGIN;

-- ── FK: user_tenants -> tenants ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_tenants_tenant_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'user_tenants'
  ) THEN
    ALTER TABLE public.user_tenants
      ADD CONSTRAINT user_tenants_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── tenants.slug column ─────────────────────────────────────────────────────
-- Frontend queries select tenants(id,name,slug,settings) but slug was missing.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS slug text;
UPDATE public.tenants SET slug = lower(replace(name, ' ', '-')) WHERE slug IS NULL;

-- ── RPC: get_refresh_token_status ───────────────────────────────────────────
-- Stub implementation: always returns trusted.
-- Full implementation should check a refresh_token_fingerprints table
-- for replay detection and revocation status.
CREATE OR REPLACE FUNCTION public.get_refresh_token_status(
  current_refresh_token_fingerprint text,
  previous_refresh_token_fingerprint text DEFAULT NULL,
  auth_event text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'trusted', true,
    'replayDetected', false,
    'revoked', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_refresh_token_status(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_refresh_token_status(text, text, text) TO service_role;

-- ── Fix security.user_has_tenant_access stubs ───────────────────────────────
-- Both overloads (text, uuid) were returning false unconditionally.
-- Replaced with real logic that checks user_tenants membership.
CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = auth.uid()::text
      AND tenant_id = target_tenant_id
      AND status = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = auth.uid()::text
      AND tenant_id = target_tenant_id::text
      AND status = 'active'
  );
END;
$$;

COMMIT;
