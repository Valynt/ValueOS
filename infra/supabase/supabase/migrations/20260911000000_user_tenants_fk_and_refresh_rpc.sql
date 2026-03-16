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

COMMIT;
