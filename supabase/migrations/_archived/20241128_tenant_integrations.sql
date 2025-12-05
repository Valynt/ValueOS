-- Tenant CRM Integrations
-- Allows admin to connect CRM once, all team members inherit access

-- ============================================================================
-- TENANT INTEGRATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('hubspot', 'salesforce', 'dynamics')),
  
  -- OAuth tokens (encrypted at rest via Supabase)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Provider-specific metadata
  instance_url TEXT,           -- Salesforce org URL
  hub_id TEXT,                 -- HubSpot portal ID
  
  -- Connection info
  connected_by UUID REFERENCES auth.users(id),
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  
  -- Scopes and status
  scopes TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, provider)
);

-- Index for quick tenant lookups
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant ON tenant_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_provider ON tenant_integrations(provider);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies (only if tenant_members table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tenant_members') THEN
    DROP POLICY IF EXISTS "Admins can manage tenant integrations" ON tenant_integrations;
    DROP POLICY IF EXISTS "Members can read integration status" ON tenant_integrations;
    
    -- Admins can manage integrations for their tenant
    CREATE POLICY "Admins can manage tenant integrations"
      ON tenant_integrations
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM tenant_members tm
          WHERE tm.tenant_id = tenant_integrations.tenant_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('admin', 'owner')
        )
      );

    -- All members can read/use integrations (but not see tokens)
    CREATE POLICY "Members can read integration status"
      ON tenant_integrations
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM tenant_members tm
          WHERE tm.tenant_id = tenant_integrations.tenant_id
            AND tm.user_id = auth.uid()
        )
      );
  ELSE
    RAISE NOTICE 'Skipping tenant_integrations RLS policies - tenant_members table does not exist';
  END IF;
END $$;

-- ============================================================================
-- INTEGRATION USAGE LOG (for audit)
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES tenant_integrations(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,  -- 'search_deals', 'get_deal', etc.
  request_summary JSONB,
  response_status TEXT,  -- 'success', 'error', 'rate_limited'
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_usage_integration ON integration_usage_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_usage_created ON integration_usage_log(created_at);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get active integration for a tenant
CREATE OR REPLACE FUNCTION get_tenant_integration(
  p_tenant_id UUID,
  p_provider TEXT
)
RETURNS TABLE (
  id UUID,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  instance_url TEXT,
  hub_id TEXT,
  scopes TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ti.id,
    ti.access_token,
    ti.refresh_token,
    ti.token_expires_at,
    ti.instance_url,
    ti.hub_id,
    ti.scopes
  FROM tenant_integrations ti
  WHERE ti.tenant_id = p_tenant_id
    AND ti.provider = p_provider
    AND ti.status = 'active';
END;
$$;

-- Update integration tokens after refresh
CREATE OR REPLACE FUNCTION update_integration_tokens(
  p_integration_id UUID,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE tenant_integrations
  SET 
    access_token = p_access_token,
    refresh_token = COALESCE(p_refresh_token, refresh_token),
    token_expires_at = p_expires_at,
    last_refreshed_at = now(),
    updated_at = now(),
    status = 'active',
    error_message = NULL
  WHERE id = p_integration_id;
END;
$$;

-- Mark integration as errored
CREATE OR REPLACE FUNCTION mark_integration_error(
  p_integration_id UUID,
  p_error_message TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE tenant_integrations
  SET 
    status = 'error',
    error_message = p_error_message,
    updated_at = now()
  WHERE id = p_integration_id;
END;
$$;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tenant_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tenant_integrations_updated_at ON tenant_integrations;

CREATE TRIGGER trigger_tenant_integrations_updated_at
  BEFORE UPDATE ON tenant_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_integrations_updated_at();
