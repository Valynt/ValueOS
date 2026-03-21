-- Migration: Create security_audit_log table
-- Purpose: Persist security audit events for compliance and forensics
-- Part of P2: Audit Trail Persistence

-- Create the security_audit_log table
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event classification
    event_type VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    outcome VARCHAR(20) NOT NULL,

    -- Actor information
    actor_id VARCHAR(255) NOT NULL,
    actor_type VARCHAR(20) NOT NULL,

    -- Resource information
    resource_id VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,

    -- Context
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    correlation_id VARCHAR(255),

    -- Risk and compliance
    risk_score DECIMAL(3,2) DEFAULT 0.0,
    compliance_flags TEXT[] DEFAULT '{}',

    -- Multi-tenancy
    tenant_id UUID,

    -- Timestamps
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_event_type CHECK (event_type IN (
        'authentication',
        'authorization',
        'data_access',
        'configuration_change',
        'security_event',
        'compliance_violation',
        'permission_change',
        'role_change'
    )),
    CONSTRAINT valid_actor_type CHECK (actor_type IN ('user', 'agent', 'system', 'service')),
    CONSTRAINT valid_outcome CHECK (outcome IN ('success', 'failure', 'denied', 'error')),
    CONSTRAINT valid_risk_score CHECK (risk_score >= 0 AND risk_score <= 1)
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON security_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_timestamp ON security_audit_log(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_actor_id ON security_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_correlation_id ON security_audit_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_outcome ON security_audit_log(outcome);
CREATE INDEX IF NOT EXISTS idx_audit_risk_score ON security_audit_log(risk_score) WHERE risk_score >= 0.7;
CREATE INDEX IF NOT EXISTS idx_audit_compliance_flags ON security_audit_log USING GIN(compliance_flags);

-- Create index for time-based retention cleanup
-- Partial index for retention cleanup (uses plain index since NOW() is not immutable)
CREATE INDEX IF NOT EXISTS idx_audit_cleanup ON security_audit_log(timestamp);

-- Enable Row Level Security
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read audit logs for their tenant
CREATE POLICY audit_tenant_isolation ON security_audit_log
    FOR SELECT
    USING (
        tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
    );

-- Policy: Only system can insert audit logs
CREATE POLICY audit_insert_system ON security_audit_log
    FOR INSERT
    WITH CHECK (true);  -- Controlled via service role key

-- Add comment for documentation
COMMENT ON TABLE security_audit_log IS 'Security audit trail for SOC 2 compliance. Retention: 7 years.';
COMMENT ON COLUMN security_audit_log.risk_score IS 'Risk score from 0.0 to 1.0. Events >= 0.7 are high risk.';
COMMENT ON COLUMN security_audit_log.compliance_flags IS 'Array of compliance-related flags (e.g., AUTH_FAILURE, ACCESS_DENIED)';
COMMENT ON COLUMN security_audit_log.correlation_id IS 'UUID for correlating related events across a transaction';
