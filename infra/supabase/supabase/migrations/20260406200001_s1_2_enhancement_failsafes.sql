-- Migration: S1-2 Enhancement - System Health Checks & Unified Maintenance
-- Created: 2026-04-06
-- Purpose: Add health monitoring and unified maintenance for idempotency system

SET search_path = public, security, pg_temp;
SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- ============================================================================
-- 1. Add idempotency system health check function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_idempotency_system_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    result jsonb;
    oldest_unexpired timestamptz;
    newest_record timestamptz;
    table_size bigint;
    table_size_mb numeric;
    total_records bigint;
    expired_but_present bigint;
    records_by_status jsonb;
    health_score integer := 100;
    warnings jsonb := '[]'::jsonb;
BEGIN
    -- Check table size (failsafe: prevent unbounded growth)
    SELECT pg_total_relation_size('public.job_processed') INTO table_size;
    table_size_mb := round(table_size::numeric / 1048576, 2);

    IF table_size > 1073741824 THEN -- 1GB threshold
        health_score := health_score - 30;
        warnings := warnings || '"table_size_exceeds_1gb"'::jsonb;
    ELSIF table_size > 536870912 THEN -- 512MB warning
        health_score := health_score - 10;
        warnings := warnings || '"table_size_warning"'::jsonb;
    END IF;

    -- Get record counts and status distribution
    SELECT
        COUNT(*),
        jsonb_object_agg(result_status, cnt)
    INTO total_records, records_by_status
    FROM (
        SELECT result_status, COUNT(*) as cnt
        FROM public.job_processed
        GROUP BY result_status
    ) sub;

    -- Check for stale records (completed jobs stuck in limbo beyond expected TTL)
    SELECT MIN(processed_at), MAX(processed_at)
    INTO oldest_unexpired, newest_record
    FROM public.job_processed
    WHERE expires_at > now();

    -- Check for expired records that should have been cleaned up
    SELECT COUNT(*) INTO expired_but_present
    FROM public.job_processed
    WHERE expires_at < now();

    IF expired_but_present > 1000 THEN
        health_score := health_score - 20;
        warnings := warnings || '"cleanup_backlog_detected"'::jsonb;
    END IF;

    -- Check for records with null result_status (data integrity issue)
    IF (records_by_status ? 'null') OR (records_by_status ? '') THEN
        health_score := health_score - 15;
        warnings := warnings || '"null_status_records_detected"'::jsonb;
    END IF;

    -- Calculate staleness of oldest record (hours)
    DECLARE
        staleness_hours numeric;
    BEGIN
        staleness_hours := CASE
            WHEN oldest_unexpired IS NULL THEN 0
            ELSE extract(epoch from (now() - oldest_unexpired))/3600
        END;

        IF staleness_hours > 168 THEN -- 7 days
            health_score := health_score - 10;
            warnings := warnings || '"very_old_unexpired_records"'::jsonb;
        END IF;

        result := jsonb_build_object(
            'healthy', health_score >= 70,
            'health_score', health_score,
            'table_size_bytes', table_size,
            'table_size_mb', table_size_mb,
            'total_records', total_records,
            'expired_but_present', expired_but_present,
            'records_by_status', COALESCE(records_by_status, '{}'::jsonb),
            'oldest_unexpired_record', oldest_unexpired,
            'newest_record', newest_record,
            'staleness_hours', round(staleness_hours, 2),
            'warnings', warnings,
            'recommendations', CASE
                WHEN health_score < 70 THEN 'URGENT: Run cleanup_expired_job_processed() and investigate'
                WHEN health_score < 90 THEN 'WARNING: Schedule cleanup and monitor growth'
                ELSE 'OK: System healthy'
            END,
            'checked_at', now()
        );
    END;

    -- Emit warning if unhealthy (consumed by monitoring)
    IF health_score < 70 THEN
        RAISE WARNING 'IDEMPOTENCY SYSTEM UNHEALTHY: score=%, warnings=%', health_score, warnings;
    ELSIF health_score < 90 THEN
        RAISE WARNING 'IDEMPOTENCY SYSTEM WARNING: score=%, warnings=%', health_score, warnings;
    END IF;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_idempotency_system_health() TO service_role;

COMMENT ON FUNCTION public.check_idempotency_system_health() IS
    'Health check for idempotency system. Returns health score 0-100, warnings, and recommendations. Call via monitoring scheduler.';

-- Note: Partial index with now() removed - now() is not IMMUTABLE.
-- The existing index idx_job_processed_expires_at is sufficient.
-- Cleanup function uses direct query on expires_at.

-- ============================================================================
-- 3. Add enhanced cleanup function with batching support
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_job_processed_batch(
    batch_size integer DEFAULT 10000,
    dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    deleted_count integer := 0;
    would_delete_count integer := 0;
BEGIN
    IF dry_run THEN
        -- Count what would be deleted
        SELECT COUNT(*) INTO would_delete_count
        FROM public.job_processed
        WHERE expires_at < now()
        LIMIT batch_size;

        RETURN jsonb_build_object(
            'dry_run', true,
            'would_delete', would_delete_count,
            'batch_size', batch_size,
            'note', 'Set dry_run=false to execute deletion'
        );
    END IF;

    -- Actual deletion with batch limit
    DELETE FROM public.job_processed
    WHERE id IN (
        SELECT id
        FROM public.job_processed
        WHERE expires_at < now()
        LIMIT batch_size
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'deleted', deleted_count,
        'batch_size', batch_size,
        'remaining', (SELECT COUNT(*) FROM public.job_processed WHERE expires_at < now()),
        'cleaned_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_job_processed_batch(integer, boolean) TO service_role;

COMMENT ON FUNCTION public.cleanup_expired_job_processed_batch(integer, boolean) IS
    'Batch cleanup of expired job records. Use dry_run=true first to preview impact. Recommended batch_size: 10000.';

-- ============================================================================
-- 4. Unified system maintenance function (combines S1-1 and S1-2 maintenance)
-- ============================================================================

CREATE OR REPLACE FUNCTION security.run_system_maintenance(
    job_cleanup_batch_size integer DEFAULT 10000,
    audit_versions_to_keep integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public, pg_temp
AS $$
DECLARE
    jobs_result jsonb;
    audit_result jsonb;
    idempotency_health jsonb;
    definer_freshness jsonb;
    start_time timestamptz;
    total_duration_ms numeric;
BEGIN
    start_time := clock_timestamp();

    -- 1. Check idempotency system health first
    idempotency_health := public.check_idempotency_system_health();

    -- 2. Cleanup expired job records (S1-2)
    jobs_result := public.cleanup_expired_job_processed_batch(
        job_cleanup_batch_size,
        false  -- not dry_run
    );

    -- 3. Prune old audit versions (S1-1)
    audit_result := security.prune_old_audit_versions(audit_versions_to_keep);

    -- 4. Check DEFINER audit freshness
    definer_freshness := security.verify_audit_freshness();

    -- Calculate duration
    total_duration_ms := round(
        extract(epoch from (clock_timestamp() - start_time)) * 1000,
        2
    );

    RETURN jsonb_build_object(
        'maintenance_run', true,
        'duration_ms', total_duration_ms,
        'jobs_cleaned', jobs_result,
        'audit_pruned', audit_result,
        'idempotency_health', jsonb_build_object(
            'pre_cleanup_score', idempotency_health->>'health_score',
            'was_healthy', (idempotency_health->>'healthy')::boolean
        ),
        'definer_audit_freshness', jsonb_build_object(
            'fresh', NOT (definer_freshness->>'stale')::boolean,
            'recommendation', definer_freshness->>'recommendation'
        ),
        'summary', CASE
            WHEN (idempotency_health->>'healthy')::boolean AND
                 NOT (definer_freshness->>'stale')::boolean
            THEN 'HEALTHY'
            WHEN (idempotency_health->>'healthy')::boolean
            THEN 'WARNING: DEFINER audit stale'
            WHEN NOT (definer_freshness->>'stale')::boolean
            THEN 'WARNING: Idempotency system issues'
            ELSE 'CRITICAL: Multiple issues detected'
        END,
        'run_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION security.run_system_maintenance(integer, integer) TO service_role;

COMMENT ON FUNCTION security.run_system_maintenance(integer, integer) IS
    'Unified maintenance routine for S1-1 and S1-2 systems. Call via pg_cron daily. Returns health status and cleanup results.';

-- ============================================================================
-- 5. Add RPC for quick health status checks (for monitoring dashboards)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_system_security_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, security, pg_temp
AS $$
DECLARE
    definer_compliance jsonb;
    idempotency_health jsonb;
    definer_freshness jsonb;
BEGIN
    -- Get DEFINER compliance status
    definer_compliance := public.get_definer_function_compliance_status();

    -- Get idempotency health
    idempotency_health := public.check_idempotency_system_health();

    -- Get audit freshness
    definer_freshness := security.verify_audit_freshness();

    RETURN jsonb_build_object(
        'overall_healthy',
            (definer_compliance->>'compliant')::boolean AND
            (idempotency_health->>'healthy')::boolean AND
            NOT (definer_freshness->>'stale')::boolean,
        'definer_functions', jsonb_build_object(
            'compliant', (definer_compliance->>'compliant')::boolean,
            'compliance_rate', definer_compliance->>'compliance_rate',
            'unverified_count', definer_compliance->'latest_audit'->>'unverified'
        ),
        'idempotency_system', jsonb_build_object(
            'healthy', (idempotency_health->>'healthy')::boolean,
            'health_score', idempotency_health->>'health_score',
            'table_size_mb', idempotency_health->>'table_size_mb'
        ),
        'audit_freshness', jsonb_build_object(
            'fresh', NOT (definer_freshness->>'stale')::boolean,
            'new_or_modified_count', definer_freshness->>'new_or_modified_count'
        ),
        'checked_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_security_status() TO service_role;

COMMENT ON FUNCTION public.get_system_security_status() IS
    'Quick consolidated security health check for monitoring dashboards. Returns overall health boolean and component details.';

COMMIT;
