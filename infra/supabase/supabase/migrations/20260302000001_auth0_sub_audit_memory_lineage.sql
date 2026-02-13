-- Migration: Canonical auth subject for audit + memory lineage writes
-- Description:
-- 1) Adds immutable auth0_sub identity shadow columns to key audit/lineage tables.
-- 2) Backfills from existing metadata/provenance when available.
-- 3) Adds indexes for auth-subject centric audit queries.
-- 4) Replaces unsafe JWT sub::uuid casts in helper function with a safe parser.

BEGIN;

-- ---------------------------------------------------------------------------
-- Add auth0_sub columns (nullable first for backfill safety)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.security_audit_log
  ADD COLUMN IF NOT EXISTS auth0_sub TEXT;

ALTER TABLE IF EXISTS public.audit_logs
  ADD COLUMN IF NOT EXISTS auth0_sub TEXT;

ALTER TABLE IF EXISTS public.agent_memory
  ADD COLUMN IF NOT EXISTS auth0_sub TEXT;

ALTER TABLE IF EXISTS public.provenance_records
  ADD COLUMN IF NOT EXISTS auth0_sub TEXT;

ALTER TABLE IF EXISTS public.assumptions
  ADD COLUMN IF NOT EXISTS auth0_sub TEXT;

-- ---------------------------------------------------------------------------
-- Backfill from existing metadata where available
-- ---------------------------------------------------------------------------
UPDATE public.security_audit_log
SET auth0_sub = COALESCE(
  metadata ->> 'auth0_sub',
  metadata ->> 'sub',
  metadata ->> 'actor_sub',
  metadata ->> 'user_sub',
  CASE WHEN user_id IS NOT NULL THEN user_id::text ELSE NULL END,
  'system'
)
WHERE auth0_sub IS NULL;

UPDATE public.audit_logs
SET auth0_sub = COALESCE(
  metadata ->> 'auth0_sub',
  metadata ->> 'sub',
  metadata ->> 'actor_sub',
  metadata ->> 'user_sub',
  CASE WHEN user_id IS NOT NULL THEN user_id::text ELSE NULL END,
  'system'
)
WHERE auth0_sub IS NULL;

UPDATE public.agent_memory
SET auth0_sub = COALESCE(
  metadata ->> 'auth0_sub',
  metadata ->> 'sub',
  provenance ->> 'auth0_sub',
  provenance ->> 'sub',
  'system'
)
WHERE auth0_sub IS NULL;

UPDATE public.provenance_records
SET auth0_sub = COALESCE(
  metadata ->> 'auth0_sub',
  metadata ->> 'sub',
  metadata ->> 'actor_sub',
  'system'
)
WHERE auth0_sub IS NULL;

UPDATE public.assumptions
SET auth0_sub = COALESCE(
  evidence ->> 'auth0_sub',
  evidence ->> 'sub',
  'system'
)
WHERE auth0_sub IS NULL;

-- ---------------------------------------------------------------------------
-- Enforce canonical identity non-nullability for all future writes
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.security_audit_log
  ALTER COLUMN auth0_sub SET DEFAULT 'system',
  ALTER COLUMN auth0_sub SET NOT NULL;

ALTER TABLE IF EXISTS public.audit_logs
  ALTER COLUMN auth0_sub SET DEFAULT 'system',
  ALTER COLUMN auth0_sub SET NOT NULL;

ALTER TABLE IF EXISTS public.agent_memory
  ALTER COLUMN auth0_sub SET DEFAULT 'system',
  ALTER COLUMN auth0_sub SET NOT NULL;

ALTER TABLE IF EXISTS public.provenance_records
  ALTER COLUMN auth0_sub SET DEFAULT 'system',
  ALTER COLUMN auth0_sub SET NOT NULL;

ALTER TABLE IF EXISTS public.assumptions
  ALTER COLUMN auth0_sub SET DEFAULT 'system',
  ALTER COLUMN auth0_sub SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Query performance indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_security_audit_log_auth0_sub
  ON public.security_audit_log(auth0_sub);

CREATE INDEX IF NOT EXISTS idx_audit_logs_auth0_sub
  ON public.audit_logs(auth0_sub);

CREATE INDEX IF NOT EXISTS idx_agent_memory_auth0_sub
  ON public.agent_memory(auth0_sub);

CREATE INDEX IF NOT EXISTS idx_provenance_records_auth0_sub
  ON public.provenance_records(auth0_sub);

CREATE INDEX IF NOT EXISTS idx_assumptions_auth0_sub
  ON public.assumptions(auth0_sub);

-- ---------------------------------------------------------------------------
-- Safe auth subject helpers (no hard cast from JWT sub -> UUID)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_auth_subject()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN public.get_current_auth_subject() ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN public.get_current_auth_subject()::uuid
    ELSE NULL
  END
$$;

REVOKE ALL ON FUNCTION public.get_current_auth_subject() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_user_id() FROM PUBLIC;

COMMIT;
