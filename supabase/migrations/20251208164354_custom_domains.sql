-- ============================================================================
-- Custom Domains Migration
-- ============================================================================
-- Enables tenants to add and verify custom domains for their organization
-- Supports DNS verification and automatic SSL certificate provisioning
-- ============================================================================

-- Create custom_domains table
CREATE TABLE IF NOT EXISTS custom_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    domain TEXT NOT NULL UNIQUE,
    verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT NOT NULL,
    verification_method TEXT NOT NULL CHECK (verification_method IN ('dns', 'http')),
    ssl_status TEXT NOT NULL DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'active', 'failed', 'expired')),
    ssl_issued_at TIMESTAMPTZ,
    ssl_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT domain_format CHECK (
        domain ~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$'
    ),
    CONSTRAINT verification_token_length CHECK (length(verification_token) >= 32)
);

-- Create indexes for performance
CREATE INDEX idx_custom_domains_tenant_id ON custom_domains(tenant_id);
CREATE INDEX idx_custom_domains_domain ON custom_domains(domain);
CREATE INDEX idx_custom_domains_verified ON custom_domains(verified) WHERE verified = TRUE;
CREATE INDEX idx_custom_domains_ssl_expires ON custom_domains(ssl_expires_at) WHERE ssl_status = 'active';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_custom_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER custom_domains_updated_at
    BEFORE UPDATE ON custom_domains
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_domains_updated_at();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can view their own domains
CREATE POLICY "Tenants can view own domains"
    ON custom_domains
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT id FROM organizations
            WHERE id = auth.uid()
            OR id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- Policy: Tenants can insert their own domains
CREATE POLICY "Tenants can insert own domains"
    ON custom_domains
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT id FROM organizations
            WHERE id = auth.uid()
            OR id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid()
                AND role IN ('owner', 'admin')
            )
        )
    );

-- Policy: Tenants can update their own domains
CREATE POLICY "Tenants can update own domains"
    ON custom_domains
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT id FROM organizations
            WHERE id = auth.uid()
            OR id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid()
                AND role IN ('owner', 'admin')
            )
        )
    );

-- Policy: Tenants can delete their own domains
CREATE POLICY "Tenants can delete own domains"
    ON custom_domains
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT id FROM organizations
            WHERE id = auth.uid()
            OR id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid()
                AND role IN ('owner', 'admin')
            )
        )
    );

-- Policy: Service role can access all domains (for domain validator service)
CREATE POLICY "Service role can access all domains"
    ON custom_domains
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE custom_domains IS 'Stores custom domains for tenant organizations with verification status';
COMMENT ON COLUMN custom_domains.id IS 'Unique identifier for the custom domain';
COMMENT ON COLUMN custom_domains.tenant_id IS 'Organization that owns this custom domain';
COMMENT ON COLUMN custom_domains.domain IS 'The custom domain (e.g., app.acme.com)';
COMMENT ON COLUMN custom_domains.verified IS 'Whether the domain ownership has been verified';
COMMENT ON COLUMN custom_domains.verification_token IS 'Token used for DNS/HTTP verification';
COMMENT ON COLUMN custom_domains.verification_method IS 'Method used for verification (dns or http)';
COMMENT ON COLUMN custom_domains.ssl_status IS 'Status of SSL certificate (pending, active, failed, expired)';
COMMENT ON COLUMN custom_domains.ssl_issued_at IS 'When the SSL certificate was issued';
COMMENT ON COLUMN custom_domains.ssl_expires_at IS 'When the SSL certificate expires';
COMMENT ON COLUMN custom_domains.verified_at IS 'When the domain was verified';
COMMENT ON COLUMN custom_domains.last_checked_at IS 'Last time verification was checked';
