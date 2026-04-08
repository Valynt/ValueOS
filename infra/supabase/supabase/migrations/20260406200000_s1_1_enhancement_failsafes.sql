-- Migration: S1-1 Enhancement - Scheduled Re-Audit and Freshness Check
-- Created: 2026-04-06
-- Purpose: Add failsafe mechanisms for continuous DEFINER function auditing

SET search_path = public, security, pg_temp;
SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- ============================================================================
-- 1. Add scheduled re-audit function with auto-alerting
-- ============================================================================

CREATE OR REPLACE FUNCTION security.schedule_definer_audit()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public, pg_temp
AS $$
DECLARE
    audit_result jsonb;
    unverified_count integer;
    alert_triggered boolean := false;
BEGIN
    -- Run the full audit
    audit_result := security.audit_all_definer_functions();
    
    -- Check for unverified functions and trigger alert if any found
    SELECT (audit_result->>'unverified_count')::integer INTO unverified_count;
    
    IF unverified_count > 0 THEN
        alert_triggered := true;
        
        -- Log warning with details (consumed by monitoring systems)
        RAISE WARNING 'SECURITY ALERT: % unverified DEFINER functions detected', unverified_count
            USING DETAIL = (audit_result->'results')::text;
    END IF;
    
    RETURN jsonb_build_object(
        'audit_run', true,
        'audit_version', audit_result->>'audit_version',
        'unverified_count', unverified_count,
        'alert_triggered', alert_triggered,
        'compliance_rate', audit_result->>'compliance_rate',
        'run_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION security.schedule_definer_audit() TO service_role;

COMMENT ON FUNCTION security.schedule_definer_audit() IS 
    'Scheduled re-audit of all DEFINER functions. Call via pg_cron or external scheduler. Emits WARNING if unverified functions detected.';

-- ============================================================================
-- 2. Add audit freshness verification to detect new/changed functions
-- ============================================================================

CREATE OR REPLACE FUNCTION security.verify_audit_freshness()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = security, public, pg_temp
AS $$
DECLARE
    current_functions jsonb;
    audited_functions jsonb;
    missing_from_audit jsonb;
    new_function_count integer;
    stale boolean;
    latest_audit_version integer;
BEGIN
    -- Get current DEFINER functions from system catalog
    SELECT jsonb_agg(jsonb_build_object(
        'oid', function_oid,
        'schema', function_schema,
        'name', function_name
    ) ORDER BY function_oid)
    INTO current_functions
    FROM security.get_all_definer_functions();
    
    -- Get latest audit version
    SELECT COALESCE(MAX(audit_version), 0) INTO latest_audit_version
    FROM security.definer_function_audit;
    
    -- Get functions from latest audit
    SELECT jsonb_agg(jsonb_build_object(
        'oid', function_oid,
        'schema', function_schema,
        'name', function_name
    ) ORDER BY function_oid)
    INTO audited_functions
    FROM security.definer_function_audit
    WHERE audit_version = latest_audit_version;
    
    -- Handle null cases
    IF current_functions IS NULL THEN
        current_functions := '[]'::jsonb;
    END IF;
    
    IF audited_functions IS NULL THEN
        audited_functions := '[]'::jsonb;
    END IF;
    
    -- Find functions not in latest audit (new or changed OIDs)
    SELECT jsonb_agg(obj), count(*)
    INTO missing_from_audit, new_function_count
    FROM jsonb_array_elements(current_functions) AS obj
    WHERE (obj->>'oid')::oid NOT IN (
        SELECT (a->>'oid')::oid 
        FROM jsonb_array_elements(audited_functions) AS a
    );
    
    stale := COALESCE(new_function_count, 0) > 0;
    
    IF stale THEN
        RAISE WARNING 'AUDIT STALE: % new or modified DEFINER functions detected since last audit', new_function_count;
    END IF;
    
    RETURN jsonb_build_object(
        'stale', stale,
        'latest_audit_version', latest_audit_version,
        'current_function_count', COALESCE(jsonb_array_length(current_functions), 0),
        'audited_function_count', COALESCE(jsonb_array_length(audited_functions), 0),
        'new_or_modified_count', COALESCE(new_function_count, 0),
        'new_functions', COALESCE(missing_from_audit, '[]'::jsonb),
        'recommendation', CASE WHEN stale THEN 'RUN AUDIT IMMEDIATELY' ELSE 'OK' END,
        'checked_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION security.verify_audit_freshness() TO service_role;

COMMENT ON FUNCTION security.verify_audit_freshness() IS 
    'Compares current database DEFINER functions against latest audit. Returns stale=true if new functions detected.';

-- ============================================================================
-- 3. Add RPC for external monitoring systems (freshness check)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_definer_audit_freshness_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, security, pg_temp
AS $$
DECLARE
    freshness_result jsonb;
BEGIN
    freshness_result := security.verify_audit_freshness();
    
    RETURN jsonb_build_object(
        'fresh', NOT (freshness_result->>'stale')::boolean,
        'compliance_status', (SELECT security.get_definer_function_compliance_status()),
        'freshness_details', freshness_result,
        'checked_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_definer_audit_freshness_status() TO service_role;

-- ============================================================================
-- 4. Add audit version pruning function (maintenance)
-- ============================================================================

CREATE OR REPLACE FUNCTION security.prune_old_audit_versions(versions_to_keep integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, pg_temp
AS $$
DECLARE
    deleted_count integer;
    current_versions integer;
    max_version integer;
BEGIN
    -- Get current state
    SELECT COUNT(DISTINCT audit_version), MAX(audit_version)
    INTO current_versions, max_version
    FROM security.definer_function_audit;
    
    -- Only prune if we have more than the threshold
    IF current_versions <= versions_to_keep THEN
        RETURN jsonb_build_object(
            'pruned', false,
            'reason', 'version_count_below_threshold',
            'current_versions', current_versions,
            'threshold', versions_to_keep
        );
    END IF;
    
    -- Delete old versions, keeping the most recent N
    DELETE FROM security.definer_function_audit
    WHERE audit_version NOT IN (
        SELECT DISTINCT audit_version 
        FROM security.definer_function_audit 
        ORDER BY audit_version DESC 
        LIMIT versions_to_keep
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN jsonb_build_object(
        'pruned', true,
        'records_deleted', deleted_count,
        'versions_kept', versions_to_keep,
        'max_version_retained', max_version,
        'pruned_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION security.prune_old_audit_versions(integer) TO service_role;

COMMENT ON FUNCTION security.prune_old_audit_versions(integer) IS 
    'Maintenance function to prune old audit versions. Default keeps last 10 versions.';

COMMIT;
