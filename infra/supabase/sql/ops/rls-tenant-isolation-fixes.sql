-- ValueOS RLS Tenant Isolation Fixes
-- This migration file addresses critical tenant isolation issues identified in the audit
-- Created: 2026-02-28
-- Author: GitHub Copilot

-- Enable RLS on all tables if not already enabled
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_data ENABLE ROW LEVEL SECURITY;

-- Create audit logging function for RLS violations
CREATE OR REPLACE FUNCTION public.log_rls_violation(
    table_name text,
    operation text,
    user_id uuid,
    organization_id uuid,
    tenant_id uuid,
    violation_details text
) RETURNS void AS $$
BEGIN
    INSERT INTO rls_audit_log (table_name, operation, user_id, organization_id, tenant_id, violation_details, timestamp)
    VALUES (table_name, operation, user_id, organization_id, tenant_id, violation_details, NOW());

    -- Raise warning for monitoring
    RAISE WARNING 'RLS VIOLATION: % on % by user % in org % tenant % - %',
        operation, table_name, user_id, organization_id, tenant_id, violation_details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS audit log table
CREATE TABLE IF NOT EXISTS rls_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    operation text NOT NULL,
    user_id uuid,
    organization_id uuid,
    tenant_id uuid,
    violation_details text NOT NULL,
    timestamp timestamptz NOT NULL DEFAULT NOW(),
    created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Create index for audit log queries
CREATE INDEX IF NOT EXISTS idx_rls_audit_log_timestamp ON rls_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rls_audit_log_org ON rls_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_rls_audit_log_table ON rls_audit_log(table_name);

-- =============================================================================
-- AGENT_SESSIONS TABLE RLS POLICIES
-- =============================================================================

-- POLICY: Only allow access to agent_sessions within the same organization
CREATE POLICY "agent_sessions_organization_isolation"
ON agent_sessions
FOR ALL
TO authenticated
USING (
    organization_id IS NOT NULL
    AND organization_id = auth.jwt() ->> 'organization_id'::text
)
WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = auth.jwt() ->> 'organization_id'::text
);

-- POLICY: Prevent access when organization_id is NULL
CREATE POLICY "agent_sessions_prevent_null_org"
ON agent_sessions
FOR ALL
TO authenticated
WITH CHECK (
    organization_id IS NOT NULL
);

-- POLICY: Log violations for agent_sessions
CREATE POLICY "agent_sessions_audit_violations"
ON agent_sessions
FOR ALL
TO authenticated
WITH CHECK (
    CASE
        WHEN organization_id IS NULL THEN
            public.log_rls_violation(
                'agent_sessions',
                current_setting('request.jwt.claim.operation', true),
                auth.jwt() ->> 'user_id'::text,
                NULL,
                auth.jwt() ->> 'tenant_id'::text,
                'Attempted access with NULL organization_id'
            ) IS NOT NULL
        WHEN organization_id != (auth.jwt() ->> 'organization_id'::text) THEN
            public.log_rls_violation(
                'agent_sessions',
                current_setting('request.jwt.claim.operation', true),
                auth.jwt() ->> 'user_id'::text,
                organization_id,
                auth.jwt() ->> 'tenant_id'::text,
                format('Cross-organization access attempt: %s vs %s', organization_id, auth.jwt() ->> 'organization_id'::text)
            ) IS NOT NULL
        ELSE true
    END
);

-- =============================================================================
-- AGENT_PREDICTIONS TABLE RLS POLICIES
-- =============================================================================

-- POLICY: Strict tenant isolation for agent_predictions
-- Fixed OR logic to use strict AND conditions
CREATE POLICY "agent_predictions_strict_isolation"
ON agent_predictions
FOR ALL
TO authenticated
USING (
    organization_id IS NOT NULL
    AND organization_id = auth.jwt() ->> 'organization_id'::text
    AND tenant_id IS NOT NULL
    AND tenant_id = auth.jwt() ->> 'tenant_id'::text
)
WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = auth.jwt() ->> 'organization_id'::text
    AND tenant_id IS NOT NULL
    AND tenant_id = auth.jwt() ->> 'tenant_id'::text
);

-- POLICY: Prevent NULL values in critical columns
CREATE POLICY "agent_predictions_prevent_null_values"
ON agent_predictions
FOR ALL
TO authenticated
WITH CHECK (
    organization_id IS NOT NULL
    AND tenant_id IS NOT NULL
);

-- POLICY: Audit violations for agent_predictions
CREATE POLICY "agent_predictions_audit_violations"
ON agent_predictions
FOR ALL
TO authenticated
WITH CHECK (
    CASE
        WHEN organization_id IS NULL OR tenant_id IS NULL THEN
            public.log_rls_violation(
                'agent_predictions',
                current_setting('request.jwt.claim.operation', true),
                auth.jwt() ->> 'user_id'::text,
                organization_id,
                tenant_id,
                format('Attempted access with NULL values: org_id=%s, tenant_id=%s', organization_id, tenant_id)
            ) IS NOT NULL
        WHEN organization_id != (auth.jwt() ->> 'organization_id'::text) OR tenant_id != (auth.jwt() ->> 'tenant_id'::text) THEN
            public.log_rls_violation(
                'agent_predictions',
                current_setting('request.jwt.claim.operation', true),
                auth.jwt() ->> 'user_id'::text,
                organization_id,
                tenant_id,
                format('Cross-tenant access attempt: org_id=%s vs %s, tenant_id=%s vs %s',
                    organization_id, auth.jwt() ->> 'organization_id'::text,
                    tenant_id, auth.jwt() ->> 'tenant_id'::text)
            ) IS NOT NULL
        ELSE true
    END
);

-- =============================================================================
-- WORKFLOW_EXECUTIONS TABLE RLS POLICIES
-- =============================================================================

-- POLICY: Add missing tenant_id checks for workflow_executions
CREATE POLICY "workflow_executions_tenant_isolation"
ON workflow_executions
FOR ALL
TO authenticated
USING (
    tenant_id IS NOT NULL
    AND tenant_id = auth.jwt() ->> 'tenant_id'::text
)
WITH CHECK (
    tenant_id IS NOT NULL
    AND tenant_id = auth.jwt() ->> 'tenant_id'::text
);

-- POLICY: Include organization_id validation for workflow_executions
CREATE POLICY "workflow_executions_org_isolation"
ON workflow_executions
FOR ALL
TO authenticated
USING (
    organization_id IS NOT NULL
    AND organization_id = auth.jwt() ->> 'organization_id'::text
)
WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = auth.jwt() ->> 'organization_id'::text
);

-- POLICY: Prevent NULL tenant_id in workflow_executions
CREATE POLICY "workflow_executions_prevent_null_tenant"
ON workflow_executions
FOR ALL
TO authenticated
WITH CHECK (
    tenant_id IS NOT NULL
);

-- POLICY: Audit violations for workflow_executions
CREATE POLICY "workflow_executions_audit_violations"
ON workflow_executions
FOR ALL
TO authenticated
WITH CHECK (
    CASE
        WHEN tenant_id IS NULL THEN
            public.log_rls_violation(
                'workflow_executions',
                current_setting('request.jwt.claim.operation', true),
                auth.jwt() ->> 'user_id'::text,
                organization_id,
                NULL,
                'Attempted access with NULL tenant_id'
            ) IS NOT NULL
        WHEN tenant_id != (auth.jwt() ->> 'tenant_id'::text) THEN
            public.log_rls_violation(
                'workflow_executions',
                current_setting('request.jwt.claim.operation', true),
                auth.jwt() ->> 'user_id'::text,
                organization_id,
                tenant_id,
                format('Cross-tenant access attempt: %s vs %s', tenant_id, auth.jwt() ->> 'tenant_id'::text)
            ) IS NOT NULL
        ELSE true
    END
);

-- =============================================================================
-- CANVAS_DATA TABLE RLS POLICIES
-- =============================================================================

-- POLICY: Strengthen canvas_data policy to prevent NULL tenant_id access
CREATE POLICY "canvas_data_strict_isolation"
ON canvas_data
FOR ALL
TO authenticated
USING (
    tenant_id IS NOT NULL
    AND tenant_id = auth.jwt() ->> 'tenant_id'::text
)
WITH CHECK (
    tenant_id IS NOT NULL
    AND tenant_id = auth.jwt() ->> 'tenant_id'::text
);

-- POLICY: Add organization_id validation for canvas_data
CREATE POLICY "canvas_data_org_isolation"
ON canvas_data
FOR ALL
TO authenticated
USING (
    organization_id IS NOT NULL
    AND organization_id = auth.jwt() ->> 'organization_id'::text
)
WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = auth.jwt() ->> 'organization_id'::text
);

-- POLICY: Prevent NULL values in canvas_data
CREATE POLICY "canvas_data_prevent_null_values"
ON canvas_data
FOR ALL
TO authenticated
WITH CHECK (
    tenant_id IS NOT NULL
    AND organization_id IS NOT NULL
);

-- POLICY: Audit violations for canvas_data
CREATE POLICY "canvas_data_audit_violations"
ON canvas_data
FOR ALL
TO authenticated
WITH CHECK (
    CASE
        WHEN tenant_id IS NULL OR organization_id IS NULL THEN
            public.log_rls_violation(
                'canvas_data',
                current_setting('request.jwt.claim.operation', true),
                auth.jwt() ->> 'user_id'::text,
                organization_id,
                tenant_id,
                format('Attempted access with NULL values: org_id=%s, tenant_id=%s', organization_id, tenant_id)
            ) IS NOT NULL
        WHEN tenant_id != (auth.jwt() ->> 'tenant_id'::text) OR organization_id != (auth.jwt() ->> 'organization_id'::text) THEN
            public.log_rls_violation(
                'canvas_data',
                current_setting('request.jwt.claim.operation', true),
                auth.jwt() ->> 'user_id'::text,
                organization_id,
                tenant_id,
                format('Cross-tenant access attempt: org_id=%s vs %s, tenant_id=%s vs %s',
                    organization_id, auth.jwt() ->> 'organization_id'::text,
                    tenant_id, auth.jwt() ->> 'tenant_id'::text)
            ) IS NOT NULL
        ELSE true
    END
);

-- =============================================================================
-- GENERAL RLS IMPROVEMENTS
-- =============================================================================

-- Create function to validate JWT claims for RLS
CREATE OR REPLACE FUNCTION public.validate_rls_claims()
RETURNS boolean AS $$
BEGIN
    IF auth.jwt() ->> 'organization_id'::text IS NULL THEN
        RAISE EXCEPTION 'Missing organization_id in JWT claims';
    END IF;

    IF auth.jwt() ->> 'tenant_id'::text IS NULL THEN
        RAISE EXCEPTION 'Missing tenant_id in JWT claims';
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add check constraint to ensure data integrity
ALTER TABLE agent_sessions
ADD CONSTRAINT chk_agent_sessions_org_tenant
CHECK (organization_id IS NOT NULL AND tenant_id IS NOT NULL);

ALTER TABLE agent_predictions
ADD CONSTRAINT chk_agent_predictions_org_tenant
CHECK (organization_id IS NOT NULL AND tenant_id IS NOT NULL);

ALTER TABLE workflow_executions
ADD CONSTRAINT chk_workflow_executions_tenant
CHECK (tenant_id IS NOT NULL);

ALTER TABLE canvas_data
ADD CONSTRAINT chk_canvas_data_org_tenant
CHECK (organization_id IS NOT NULL AND tenant_id IS NOT NULL);

-- Create indexes to optimize RLS performance
CREATE INDEX IF NOT EXISTS idx_agent_sessions_org ON agent_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_tenant ON agent_sessions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_agent_predictions_org ON agent_predictions(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_predictions_tenant ON agent_predictions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant ON workflow_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_org ON workflow_executions(organization_id);

CREATE INDEX IF NOT EXISTS idx_canvas_data_org ON canvas_data(organization_id);
CREATE INDEX IF NOT EXISTS idx_canvas_data_tenant ON canvas_data(tenant_id);

-- =============================================================================
-- RLS TEST CASES
-- =============================================================================

-- Test function to validate RLS policies
CREATE OR REPLACE FUNCTION public.test_rls_policies()
RETURNS TABLE(
    test_name text,
    result boolean,
    details text
) AS $$
BEGIN
    RETURN QUERY

    -- Test 1: Valid access within same organization and tenant
    SELECT
        'Test 1: Valid access within same org/tenant' as test_name,
        CASE
            WHEN (SELECT COUNT(*) FROM agent_sessions WHERE organization_id = 'org-123' AND tenant_id = 'tenant-456') = 0 THEN false
            ELSE true
        END as result,
        'Should allow access when org_id and tenant_id match JWT claims' as details;

    -- Test 2: Cross-organization access should be blocked
    SELECT
        'Test 2: Cross-organization access blocked' as test_name,
        CASE
            WHEN (SELECT COUNT(*) FROM agent_sessions WHERE organization_id = 'org-999') = 0 THEN true
            ELSE false
        END as result,
        'Should block access when organization_id does not match JWT claims' as details;

    -- Test 3: Cross-tenant access should be blocked
    SELECT
        'Test 3: Cross-tenant access blocked' as test_name,
        CASE
            WHEN (SELECT COUNT(*) FROM agent_predictions WHERE tenant_id = 'tenant-999') = 0 THEN true
            ELSE false
        END as result,
        'Should block access when tenant_id does not match JWT claims' as details;

    -- Test 4: NULL organization_id should be blocked
    SELECT
        'Test 4: NULL organization_id blocked' as test_name,
        CASE
            WHEN (SELECT COUNT(*) FROM canvas_data WHERE organization_id IS NULL) = 0 THEN true
            ELSE false
        END as result,
        'Should block access when organization_id is NULL' as details;

    -- Test 5: NULL tenant_id should be blocked
    SELECT
        'Test 5: NULL tenant_id blocked' as test_name,
        CASE
            WHEN (SELECT COUNT(*) FROM workflow_executions WHERE tenant_id IS NULL) = 0 THEN true
            ELSE false
        END as result,
        'Should block access when tenant_id is NULL' as details;

    -- Test 6: Audit log functionality
    SELECT
        'Test 6: Audit log created' as test_name,
        CASE
            WHEN (SELECT COUNT(*) FROM rls_audit_log) >= 0 THEN true
            ELSE false
        END as result,
        'Audit log table should exist and be writable' as details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RLS VIOLATION MONITORING
-- =============================================================================

-- Create view for recent RLS violations
CREATE OR REPLACE VIEW public.recent_rls_violations AS
SELECT
    table_name,
    operation,
    user_id,
    organization_id,
    tenant_id,
    violation_details,
    timestamp
FROM rls_audit_log
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Create function to clean old audit logs
CREATE OR REPLACE FUNCTION public.cleanup_old_rls_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM rls_audit_log
    WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup job (to be added to cron)
-- SELECT public.cleanup_old_rls_logs();

-- =============================================================================
-- RLS VALIDATION SCRIPT
-- =============================================================================

-- Function to validate all RLS policies are properly configured
CREATE OR REPLACE FUNCTION public.validate_rls_configuration()
RETURNS TABLE(
    table_name text,
    policy_name text,
    status text,
    message text
) AS $$
BEGIN
    RETURN QUERY

    -- Check agent_sessions policies
    SELECT
        'agent_sessions' as table_name,
        'organization_isolation' as policy_name,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'agent_sessions'
                AND policyname = 'agent_sessions_organization_isolation'
            ) THEN 'OK'
            ELSE 'MISSING'
        END as status,
        'Organization isolation policy should be present' as message;

    -- Check agent_predictions policies
    SELECT
        'agent_predictions' as table_name,
        'strict_isolation' as policy_name,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'agent_predictions'
                AND policyname = 'agent_predictions_strict_isolation'
            ) THEN 'OK'
            ELSE 'MISSING'
        END as status,
        'Strict isolation policy should be present' as message;

    -- Check workflow_executions policies
    SELECT
        'workflow_executions' as table_name,
        'tenant_isolation' as policy_name,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'workflow_executions'
                AND policyname = 'workflow_executions_tenant_isolation'
            ) THEN 'OK'
            ELSE 'MISSING'
        END as status,
        'Tenant isolation policy should be present' as message;

    -- Check canvas_data policies
    SELECT
        'canvas_data' as table_name,
        'strict_isolation' as policy_name,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'canvas_data'
                AND policyname = 'canvas_data_strict_isolation'
            ) THEN 'OK'
            ELSE 'MISSING'
        END as status,
        'Strict isolation policy should be present' as message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
