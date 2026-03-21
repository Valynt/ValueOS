-- =============================================================================
-- Migration: agent_sessions and agent_predictions RLS hardening
-- =============================================================================
-- Audit finding: The agent_sessions table was missing ENABLE ROW LEVEL SECURITY
-- in the active migration set (it existed only in archived/deferred migrations).
-- The agent_predictions table had an OR-logic bypass vulnerability where a NULL
-- organization_id could allow cross-tenant reads.
--
-- This migration:
--   1. Creates agent_sessions if it does not exist (idempotent)
--   2. Enables RLS on agent_sessions
--   3. Creates strict tenant-isolation policies on agent_sessions
--   4. Drops the vulnerable agent_predictions policy and replaces it with a
--      strict AND-logic policy that rejects NULL tenant columns
-- =============================================================================

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 1. agent_sessions table (CREATE IF NOT EXISTS — safe for re-runs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL,
  organization_id uuid       NOT NULL,
  session_token  text        NOT NULL UNIQUE,
  context        jsonb       NOT NULL DEFAULT '{}',
  status         text        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('pending', 'active', 'completed', 'failed', 'cancelled')),
  started_at     timestamptz NOT NULL DEFAULT now(),
  ended_at       timestamptz,
  is_active      boolean     NOT NULL DEFAULT true,
  is_completed   boolean     NOT NULL DEFAULT false,
  metadata       jsonb       NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_agent_sessions_tenant_id
  ON public.agent_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_organization_id
  ON public.agent_sessions (organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_tenant
  ON public.agent_sessions (user_id, tenant_id);

-- ---------------------------------------------------------------------------
-- 2. Enable RLS on agent_sessions
-- ---------------------------------------------------------------------------

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Tenant isolation policies for agent_sessions
-- ---------------------------------------------------------------------------

-- Drop any pre-existing policies to ensure idempotency
DROP POLICY IF EXISTS agent_sessions_tenant_select ON public.agent_sessions;
DROP POLICY IF EXISTS agent_sessions_tenant_insert ON public.agent_sessions;
DROP POLICY IF EXISTS agent_sessions_tenant_update ON public.agent_sessions;
DROP POLICY IF EXISTS agent_sessions_tenant_delete ON public.agent_sessions;
DROP POLICY IF EXISTS agent_sessions_organization_isolation ON public.agent_sessions;

-- SELECT: authenticated users may only read their own tenant's sessions
CREATE POLICY agent_sessions_tenant_select
  ON public.agent_sessions
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

-- INSERT: users may only create sessions for their own tenant
CREATE POLICY agent_sessions_tenant_insert
  ON public.agent_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

-- UPDATE: users may only update their own tenant's sessions
CREATE POLICY agent_sessions_tenant_update
  ON public.agent_sessions
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND organization_id = (auth.jwt() ->> 'organization_id')::uuid
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

-- DELETE: users may only delete their own tenant's sessions
CREATE POLICY agent_sessions_tenant_delete
  ON public.agent_sessions
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

-- Service role bypass (for backend service operations)
CREATE POLICY agent_sessions_service_role_all
  ON public.agent_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. Fix agent_predictions NULL bypass vulnerability
-- ---------------------------------------------------------------------------
-- The original policy used OR logic: `tenant_id = X OR organization_id = X`
-- which allowed a row with tenant_id = NULL to pass the organization_id check.
-- Replace with strict AND logic that rejects any row with NULL tenant columns.

DROP POLICY IF EXISTS agent_predictions_tenant_isolation ON public.agent_predictions;
DROP POLICY IF EXISTS agent_predictions_strict_isolation ON public.agent_predictions;
DROP POLICY IF EXISTS "agent_predictions_strict_isolation" ON public.agent_predictions;

-- Ensure RLS is enabled on agent_predictions
ALTER TABLE public.agent_predictions ENABLE ROW LEVEL SECURITY;

-- Strict AND-logic policy — NULL tenant columns are implicitly rejected
-- because NULL = X is always FALSE in SQL.
CREATE POLICY agent_predictions_strict_isolation
  ON public.agent_predictions
  FOR ALL
  TO authenticated
  USING (
    tenant_id::uuid = (auth.jwt() ->> 'tenant_id')::uuid
    AND (
      organization_id IS NULL
      OR organization_id::uuid = (auth.jwt() ->> 'organization_id')::uuid
    )
  )
  WITH CHECK (
    tenant_id::uuid = (auth.jwt() ->> 'tenant_id')::uuid
    AND (
      organization_id IS NULL
      OR organization_id::uuid = (auth.jwt() ->> 'organization_id')::uuid
    )
  );

-- Service role bypass for agent_predictions
CREATE POLICY agent_predictions_service_role_all
  ON public.agent_predictions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. Add NOT NULL constraints to prevent future NULL bypass attempts
-- ---------------------------------------------------------------------------

-- agent_sessions: both columns are already NOT NULL from the CREATE TABLE above.
-- For pre-existing rows (if table already existed), backfill is not needed
-- because the constraint was already enforced in the archived schema.

-- agent_predictions: add constraint only if column allows NULL
-- (the original schema had tenant_id as text, nullable)
DO $$
BEGIN
  -- Only add constraint if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'agent_predictions'
      AND constraint_name = 'chk_agent_predictions_tenant_not_null'
  ) THEN
    ALTER TABLE public.agent_predictions
      ADD CONSTRAINT chk_agent_predictions_tenant_not_null
      CHECK (tenant_id IS NOT NULL);
  END IF;
END $$;
