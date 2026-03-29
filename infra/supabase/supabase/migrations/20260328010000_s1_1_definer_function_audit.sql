-- Migration: S1-1 - Audit All SECURITY DEFINER Functions
-- Created: 2026-03-28
-- Purpose: Add monitoring, verification, and enforcement for SECURITY DEFINER functions

SET search_path = public, security, pg_temp;

BEGIN;

-- ============================================================================
-- 1. Create table to track DEFINER function audit results
-- ============================================================================

CREATE TABLE IF NOT EXISTS security.definer_function_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    function_schema text NOT NULL,
    function_name text NOT NULL,
    function_oid oid NOT NULL,
    has_tenant_verification boolean NOT NULL DEFAULT false,
    verification_method text, -- 'user_has_tenant_access', 'manual_check', 'service_role_only', 'none'
    audit_timestamp timestamptz NOT NULL DEFAULT now(),
    audit_version integer NOT NULL DEFAULT 1,
    CONSTRAINT unique_function_oid_version UNIQUE (function_oid, audit_version)
);

-- Enable RLS
ALTER TABLE security.definer_function_audit ENABLE ROW LEVEL SECURITY;

-- Only service_role can access audit logs
CREATE POLICY definer_function_audit_service_role ON security.definer_function_audit
    FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON security.definer_function_audit FROM PUBLIC;
GRANT ALL ON security.definer_function_audit TO service_role;

-- ============================================================================
-- 2. Create function to detect all SECURITY DEFINER functions
-- ============================================================================

CREATE OR REPLACE FUNCTION security.get_all_definer_functions()
RETURNS TABLE (
    function_schema text,
    function_name text,
    function_oid oid,
    returns_set boolean,
    return_type text,
    security_type text
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT 
        n.nspname::text as function_schema,
        p.proname::text as function_name,
        p.oid as function_oid,
        p.proretset as returns_set,
        pg_get_function_result(p.oid)::text as return_type,
        CASE 
            WHEN p.prosecdef THEN 'SECURITY DEFINER'
            ELSE 'SECURITY INVOKER'
        END::text as security_type
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true
        AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY n.nspname, p.proname;
$$;

-- ============================================================================
-- 3. Create function to check if a function has tenant verification
-- ============================================================================

CREATE OR REPLACE FUNCTION security.check_definer_has_tenant_verification(
    target_oid oid
)
RETURNS TABLE (
    has_verification boolean,
    verification_method text
)
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    func_source text;
    func_name text;
    func_schema text;
BEGIN
    -- Get function source and name
    SELECT 
        p.prosrc,
        p.proname,
        n.nspname
    INTO func_source, func_name, func_schema
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.oid = target_oid;

    -- Check for various verification patterns
    IF func_source IS NULL THEN
        RETURN QUERY SELECT false::boolean, 'no_source'::text;
        RETURN;
    END IF;

    -- Check for user_has_tenant_access call
    IF func_source ~* 'user_has_tenant_access' THEN
        RETURN QUERY SELECT true::boolean, 'user_has_tenant_access'::text;
        RETURN;
    END IF;

    -- Check for explicit service_role check at start
    IF func_source ~* 'service_role.*true' OR func_source ~* 'request\.jwt\.claim\.role.*service_role' THEN
        RETURN QUERY SELECT true::boolean, 'service_role_only'::text;
        RETURN;
    END IF;

    -- Check for manual tenant_id validation
    IF func_source ~* 'tenant_id.*=.*auth\.uid' OR 
       func_source ~* 'tenant_id.*=.*current_setting' OR
       func_source ~* 'SELECT.*tenant_id.*FROM' THEN
        RETURN QUERY SELECT true::boolean, 'manual_check'::text;
        RETURN;
    END IF;

    -- Special cases: utility functions that don't need tenant checks
    IF func_name IN (
        'create_next_monthly_partitions',
        'rotate_security_audit_logs',
        'verify_security_audit_archive_integrity'
    ) AND func_schema = 'public' THEN
        RETURN QUERY SELECT true::boolean, 'service_role_admin'::text;
        RETURN;
    END IF;

    RETURN QUERY SELECT false::boolean, 'none'::text;
END;
$$;

-- ============================================================================
-- 4. Create function to run full DEFINER audit
-- ============================================================================

CREATE OR REPLACE FUNCTION security.audit_all_definer_functions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public, pg_temp
AS $$
DECLARE
    rec record;
    check_result record;
    total_count integer := 0;
    verified_count integer := 0;
    unverified_count integer := 0;
    results jsonb := '[]'::jsonb;
    new_version integer;
BEGIN
    -- Get next audit version
    SELECT COALESCE(MAX(audit_version), 0) + 1 INTO new_version FROM security.definer_function_audit;

    FOR rec IN SELECT * FROM security.get_all_definer_functions()
    LOOP
        total_count := total_count + 1;
        
        SELECT * INTO check_result 
        FROM security.check_definer_has_tenant_verification(rec.function_oid);

        -- Insert audit record
        INSERT INTO security.definer_function_audit (
            function_schema, function_name, function_oid, 
            has_tenant_verification, verification_method, audit_version
        ) VALUES (
            rec.function_schema, rec.function_name, rec.function_oid,
            check_result.has_verification, check_result.verification_method, new_version
        );

        IF check_result.has_verification THEN
            verified_count := verified_count + 1;
        ELSE
            unverified_count := unverified_count + 1;
        END IF;

        results := results || jsonb_build_object(
            'schema', rec.function_schema,
            'name', rec.function_name,
            'oid', rec.function_oid,
            'verified', check_result.has_verification,
            'method', check_result.verification_method
        );
    END LOOP;

    RETURN jsonb_build_object(
        'audit_version', new_version,
        'audit_timestamp', now(),
        'total_definer_functions', total_count,
        'verified_count', verified_count,
        'unverified_count', unverified_count,
        'compliance_rate', CASE WHEN total_count > 0 
            THEN round(verified_count::numeric / total_count * 100, 2)
            ELSE 0 
        END,
        'results', results
    );
END;
$$;

-- Grant execution to service_role
GRANT EXECUTE ON FUNCTION security.audit_all_definer_functions() TO service_role;

-- ============================================================================
-- 5. Create alerting function for new unverified DEFINER functions
-- ============================================================================

CREATE OR REPLACE FUNCTION security.check_unverified_definer_functions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = security, public, pg_temp
AS $$
DECLARE
    unverified_count integer;
    unverified_list jsonb;
BEGIN
    SELECT 
        count(*),
        jsonb_agg(jsonb_build_object(
            'schema', function_schema,
            'name', function_name,
            'oid', function_oid
        ))
    INTO unverified_count, unverified_list
    FROM security.definer_function_audit
    WHERE audit_version = (SELECT MAX(audit_version) FROM security.definer_function_audit)
        AND has_tenant_verification = false;

    RETURN jsonb_build_object(
        'has_unverified', unverified_count > 0,
        'unverified_count', unverified_count,
        'unverified_functions', COALESCE(unverified_list, '[]'::jsonb),
        'checked_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION security.check_unverified_definer_functions() TO service_role;

-- ============================================================================
-- 6. Create RPC for external monitoring systems
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_definer_function_compliance_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, security, pg_temp
AS $$
DECLARE
    latest_audit jsonb;
    unverified_check jsonb;
BEGIN
    -- Get latest audit results
    SELECT jsonb_build_object(
        'version', MAX(audit_version),
        'timestamp', MAX(audit_timestamp),
        'total', COUNT(*),
        'verified', COUNT(*) FILTER (WHERE has_tenant_verification = true),
        'unverified', COUNT(*) FILTER (WHERE has_tenant_verification = false)
    ) INTO latest_audit
    FROM security.definer_function_audit
    WHERE audit_version = (SELECT MAX(audit_version) FROM security.definer_function_audit);

    -- Get unverified details
    SELECT security.check_unverified_definer_functions() INTO unverified_check;

    RETURN jsonb_build_object(
        'compliant', (latest_audit->>'unverified')::integer = 0,
        'compliance_rate', CASE 
            WHEN (latest_audit->>'total')::integer > 0 
            THEN round((latest_audit->>'verified')::integer / (latest_audit->>'total')::integer::numeric * 100, 2)
            ELSE 0 
        END,
        'latest_audit', latest_audit,
        'unverified_details', unverified_check,
        'checked_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_definer_function_compliance_status() TO service_role;

-- ============================================================================
-- 7. Run initial audit
-- ============================================================================

SELECT security.audit_all_definer_functions();

COMMIT;
