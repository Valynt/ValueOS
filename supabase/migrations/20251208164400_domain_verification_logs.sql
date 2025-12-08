-- ============================================================================
-- Domain Verification Logs Migration
-- ============================================================================
-- Tracks all domain verification attempts for audit and troubleshooting
-- ============================================================================

-- Create domain_verification_logs table
CREATE TABLE IF NOT EXISTS domain_verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES custom_domains(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    verification_method TEXT NOT NULL CHECK (verification_method IN ('dns', 'http')),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    error_message TEXT,
    dns_records JSONB,
    http_response JSONB,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    user_agent TEXT,
    ip_address INET,
    request_id TEXT
);

-- Create indexes for performance
CREATE INDEX idx_domain_verification_logs_domain_id ON domain_verification_logs(domain_id);
CREATE INDEX idx_domain_verification_logs_tenant_id ON domain_verification_logs(tenant_id);
CREATE INDEX idx_domain_verification_logs_checked_at ON domain_verification_logs(checked_at DESC);
CREATE INDEX idx_domain_verification_logs_status ON domain_verification_logs(status);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE domain_verification_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can view their own verification logs
CREATE POLICY "Tenants can view own verification logs"
    ON domain_verification_logs
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

-- Policy: Service role can insert verification logs
CREATE POLICY "Service role can insert verification logs"
    ON domain_verification_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Policy: Service role can access all logs
CREATE POLICY "Service role can access all logs"
    ON domain_verification_logs
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- Helper function to log verification attempts
-- ============================================================================

CREATE OR REPLACE FUNCTION log_domain_verification(
    p_domain_id UUID,
    p_tenant_id UUID,
    p_verification_method TEXT,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL,
    p_dns_records JSONB DEFAULT NULL,
    p_http_response JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO domain_verification_logs (
        domain_id,
        tenant_id,
        verification_method,
        status,
        error_message,
        dns_records,
        http_response
    ) VALUES (
        p_domain_id,
        p_tenant_id,
        p_verification_method,
        p_status,
        p_error_message,
        p_dns_records,
        p_http_response
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE domain_verification_logs IS 'Audit log of all domain verification attempts';
COMMENT ON COLUMN domain_verification_logs.id IS 'Unique identifier for the log entry';
COMMENT ON COLUMN domain_verification_logs.domain_id IS 'Reference to the custom domain being verified';
COMMENT ON COLUMN domain_verification_logs.tenant_id IS 'Organization that owns the domain';
COMMENT ON COLUMN domain_verification_logs.verification_method IS 'Method used for verification (dns or http)';
COMMENT ON COLUMN domain_verification_logs.status IS 'Result of the verification attempt';
COMMENT ON COLUMN domain_verification_logs.error_message IS 'Error message if verification failed';
COMMENT ON COLUMN domain_verification_logs.dns_records IS 'DNS records found during verification (JSON)';
COMMENT ON COLUMN domain_verification_logs.http_response IS 'HTTP response during verification (JSON)';
COMMENT ON COLUMN domain_verification_logs.checked_at IS 'When the verification was attempted';
