-- Active migration for crm_connections.
--
-- This table was only in the archived monolith migration. CrmConnectionService
-- references it directly; without an active migration it is absent from any
-- clean-apply schema and the re-encryption job has no target table.

SET search_path = public, pg_temp;

CREATE TABLE IF NOT EXISTS public.crm_connections (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid        NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  provider                    text        NOT NULL,
  status                      text        NOT NULL DEFAULT 'disconnected',
  access_token_enc            text,
  refresh_token_enc           text,
  token_key_version           integer     NOT NULL DEFAULT 1,
  token_expires_at            timestamptz,
  instance_url                text,
  external_org_id             text,
  external_user_id            text,
  scopes                      text[]      DEFAULT '{}',
  sync_cursor                 text,
  last_sync_at                timestamptz,
  last_successful_sync_at     timestamptz,
  last_error                  jsonb,
  connected_by                text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_connections_provider_check
    CHECK (provider IN ('salesforce', 'hubspot')),
  CONSTRAINT crm_connections_status_check
    CHECK (status IN ('connected', 'disconnected', 'error', 'expired')),
  CONSTRAINT crm_connections_tenant_provider_unique
    UNIQUE (tenant_id, provider)
);

-- token_key_version tracks which encryption key version was used for the
-- stored tokens. The re-encryption job filters on this column to find rows
-- that need re-encryption after a key rotation.
CREATE INDEX IF NOT EXISTS idx_crm_connections_tenant
  ON public.crm_connections (tenant_id);

CREATE INDEX IF NOT EXISTS idx_crm_connections_key_version
  ON public.crm_connections (token_key_version)
  WHERE access_token_enc IS NOT NULL;

ALTER TABLE public.crm_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_connections_tenant_select ON public.crm_connections
  FOR SELECT USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY crm_connections_tenant_insert ON public.crm_connections
  FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY crm_connections_tenant_update ON public.crm_connections
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id::text))
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY crm_connections_tenant_delete ON public.crm_connections
  FOR DELETE USING (security.user_has_tenant_access(tenant_id::text));

-- authenticated users may manage their own connection rows (status, metadata)
-- but must never read the encrypted token values — those are service_role only.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_connections TO authenticated;
REVOKE SELECT (access_token_enc, refresh_token_enc) ON public.crm_connections FROM authenticated;
GRANT ALL ON public.crm_connections TO service_role;
