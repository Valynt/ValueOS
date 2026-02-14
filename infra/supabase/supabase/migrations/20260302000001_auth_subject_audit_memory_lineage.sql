-- Migration: Canonical auth subject for audit + memory lineage writes
-- Description:
-- 1) Adds immutable auth_subject identity shadow columns to key audit/lineage tables.
-- 2) Backfills from existing metadata/provenance when available.
-- 3) Adds tenant_id where missing for tenant-scoped lineage data.
-- 4) Adds indexes for tenant/auth-subject centric audit queries.
-- 5) Replaces unsafe JWT sub::uuid casts in helper function with safe Supabase auth helpers.

BEGIN;

-- ---------------------------------------------------------------------------
-- Add canonical identity columns (nullable first for backfill safety)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.security_audit_log
  ADD COLUMN IF NOT EXISTS auth_subject TEXT;

ALTER TABLE IF EXISTS public.audit_logs
  ADD COLUMN IF NOT EXISTS auth_subject TEXT;

ALTER TABLE IF EXISTS public.agent_memory
  ADD COLUMN IF NOT EXISTS auth_subject TEXT,
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE IF EXISTS public.provenance_records
  ADD COLUMN IF NOT EXISTS auth_subject TEXT,
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE IF EXISTS public.assumptions
  ADD COLUMN IF NOT EXISTS auth_subject TEXT,
  ADD COLUMN IF NOT EXISTS tenant_id UUID;


CREATE OR REPLACE FUNCTION public.try_parse_uuid(p_value text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN p_value::uuid
    ELSE NULL
  END
$$;

-- ---------------------------------------------------------------------------
-- Backfill auth_subject from legacy fields where available
-- ---------------------------------------------------------------------------
UPDATE public.security_audit_log
SET auth_subject = COALESCE(
  auth_subject,
  metadata ->> 'auth_subject',
  metadata ->> 'auth0_sub',
  metadata ->> 'sub',
  metadata ->> 'actor_sub',
  metadata ->> 'user_sub',
  CASE WHEN user_id IS NOT NULL THEN user_id::text ELSE NULL END,
  'system'
)
WHERE auth_subject IS NULL;

UPDATE public.audit_logs
SET auth_subject = COALESCE(
  auth_subject,
  metadata ->> 'auth_subject',
  metadata ->> 'auth0_sub',
  metadata ->> 'sub',
  metadata ->> 'actor_sub',
  metadata ->> 'user_sub',
  CASE WHEN user_id IS NOT NULL THEN user_id::text ELSE NULL END,
  'system'
)
WHERE auth_subject IS NULL;

UPDATE public.agent_memory
SET
  auth_subject = COALESCE(
    auth_subject,
      metadata ->> 'auth_subject',
    metadata ->> 'auth0_sub',
    metadata ->> 'sub',
    provenance ->> 'auth_subject',
    provenance ->> 'auth0_sub',
    provenance ->> 'sub',
    'system'
  ),
  tenant_id = COALESCE(
    tenant_id,
    organization_id,
    public.try_parse_uuid(NULLIF(metadata ->> 'tenant_id', '')),
    public.try_parse_uuid(NULLIF(metadata ->> 'organization_id', '')),
    public.try_parse_uuid(NULLIF(metadata ->> 'tenantId', '')),
    public.try_parse_uuid(NULLIF(provenance ->> 'tenant_id', '')),
    public.try_parse_uuid(NULLIF(provenance ->> 'organization_id', '')),
    public.try_parse_uuid(NULLIF(provenance ->> 'tenantId', ''))
  )
WHERE auth_subject IS NULL OR tenant_id IS NULL;

UPDATE public.provenance_records
SET
  auth_subject = COALESCE(
    auth_subject,
      metadata ->> 'auth_subject',
    metadata ->> 'auth0_sub',
    metadata ->> 'sub',
    metadata ->> 'actor_sub',
    'system'
  ),
  tenant_id = COALESCE(
    tenant_id,
    organization_id,
    public.try_parse_uuid(NULLIF(metadata ->> 'tenant_id', '')),
    public.try_parse_uuid(NULLIF(metadata ->> 'organization_id', '')),
    public.try_parse_uuid(NULLIF(metadata ->> 'tenantId', ''))
  )
WHERE auth_subject IS NULL OR tenant_id IS NULL;

UPDATE public.assumptions
SET
  auth_subject = COALESCE(
    auth_subject,
      evidence ->> 'auth_subject',
    evidence ->> 'auth0_sub',
    evidence ->> 'sub',
    'system'
  ),
  tenant_id = COALESCE(
    tenant_id,
    organization_id,
    public.try_parse_uuid(NULLIF(evidence ->> 'tenant_id', '')),
    public.try_parse_uuid(NULLIF(evidence ->> 'organization_id', '')),
    public.try_parse_uuid(NULLIF(evidence ->> 'tenantId', ''))
  )
WHERE auth_subject IS NULL OR tenant_id IS NULL;

-- ---------------------------------------------------------------------------
-- Enforce canonical identity non-nullability for all future writes
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.security_audit_log
  ALTER COLUMN auth_subject SET DEFAULT 'system',
  ALTER COLUMN auth_subject SET NOT NULL;

ALTER TABLE IF EXISTS public.audit_logs
  ALTER COLUMN auth_subject SET DEFAULT 'system',
  ALTER COLUMN auth_subject SET NOT NULL;

ALTER TABLE IF EXISTS public.agent_memory
  ALTER COLUMN auth_subject SET DEFAULT 'system',
  ALTER COLUMN auth_subject SET NOT NULL;

ALTER TABLE IF EXISTS public.provenance_records
  ALTER COLUMN auth_subject SET DEFAULT 'system',
  ALTER COLUMN auth_subject SET NOT NULL;

ALTER TABLE IF EXISTS public.assumptions
  ALTER COLUMN auth_subject SET DEFAULT 'system',
  ALTER COLUMN auth_subject SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Query performance indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_security_audit_log_auth_subject
  ON public.security_audit_log(auth_subject);

CREATE INDEX IF NOT EXISTS idx_audit_logs_auth_subject
  ON public.audit_logs(auth_subject);

CREATE INDEX IF NOT EXISTS idx_agent_memory_tenant_auth_subject
  ON public.agent_memory(tenant_id, auth_subject);

CREATE INDEX IF NOT EXISTS idx_provenance_records_tenant_auth_subject
  ON public.provenance_records(tenant_id, auth_subject);

CREATE INDEX IF NOT EXISTS idx_assumptions_tenant_auth_subject
  ON public.assumptions(tenant_id, auth_subject);

-- ---------------------------------------------------------------------------
-- Safe Supabase auth helpers (no hard cast from JWT sub -> UUID)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_auth_subject()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'sub', ''),
    CASE WHEN auth.uid() IS NOT NULL THEN auth.uid()::text ELSE NULL END
  )
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid()
$$;

REVOKE ALL ON FUNCTION public.get_current_auth_subject() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_user_id() FROM PUBLIC;

COMMIT;
