-- Migration: S1-2 - Idempotency for BullMQ Workers
-- Created: 2026-03-28
-- Purpose: Create job_processed table for BullMQ worker idempotency

SET search_path = public, pg_temp;

BEGIN;

-- ============================================================================
-- 1. Create table for job deduplication
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_processed (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key text NOT NULL,
    queue_name text NOT NULL,
    job_name text NOT NULL,
    job_data_hash text NOT NULL, -- SHA256 hash of job data for integrity
    tenant_id text,
    organization_id text,
    processed_at timestamptz NOT NULL DEFAULT now(),
    processed_by text, -- worker instance identifier
    result_status text, -- 'completed', 'failed', 'skipped_duplicate'
    result_payload jsonb, -- optional result data for cache hits
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    
    CONSTRAINT unique_idempotency_key UNIQUE (idempotency_key, queue_name)
);

-- Enable RLS
ALTER TABLE public.job_processed ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY job_processed_tenant_isolation ON public.job_processed
    FOR ALL TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::text);

-- Service role can access all
CREATE POLICY job_processed_service_role ON public.job_processed
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Lock down privileges
REVOKE ALL ON public.job_processed FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_processed TO service_role;
GRANT SELECT ON public.job_processed TO authenticated;

-- ============================================================================
-- 2. Create indexes for efficient lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_job_processed_idempotency_key 
    ON public.job_processed(idempotency_key, queue_name);

CREATE INDEX IF NOT EXISTS idx_job_processed_tenant_id 
    ON public.job_processed(tenant_id);

CREATE INDEX IF NOT EXISTS idx_job_processed_expires_at 
    ON public.job_processed(expires_at);

CREATE INDEX IF NOT EXISTS idx_job_processed_processed_at 
    ON public.job_processed(processed_at);

-- Partial index for active (non-expired) entries
CREATE INDEX IF NOT EXISTS idx_job_processed_active 
    ON public.job_processed(idempotency_key, queue_name) 
    WHERE expires_at > now();

-- ============================================================================
-- 3. Create cleanup function for expired entries
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_job_processed()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.job_processed 
    WHERE expires_at < now();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_job_processed() TO service_role;

-- ============================================================================
-- 4. Create RPC to check job status
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_job_idempotency_status(
    p_idempotency_key text,
    p_queue_name text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    existing_record record;
BEGIN
    SELECT * INTO existing_record
    FROM public.job_processed
    WHERE idempotency_key = p_idempotency_key 
        AND queue_name = p_queue_name
        AND expires_at > now();
    
    IF existing_record IS NULL THEN
        RETURN jsonb_build_object(
            'exists', false,
            'should_process', true
        );
    END IF;
    
    RETURN jsonb_build_object(
        'exists', true,
        'should_process', false,
        'processed_at', existing_record.processed_at,
        'status', existing_record.result_status,
        'result', existing_record.result_payload
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_job_idempotency_status(text, text) TO service_role;

-- ============================================================================
-- 5. Create RPC to mark job as processed
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_job_processed(
    p_idempotency_key text,
    p_queue_name text,
    p_job_name text,
    p_job_data_hash text,
    p_tenant_id text DEFAULT NULL,
    p_organization_id text DEFAULT NULL,
    p_processed_by text DEFAULT NULL,
    p_result_status text DEFAULT 'completed',
    p_result_payload jsonb DEFAULT NULL,
    p_ttl_hours integer DEFAULT 168  -- 7 days default
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    record_id uuid;
BEGIN
    INSERT INTO public.job_processed (
        idempotency_key,
        queue_name,
        job_name,
        job_data_hash,
        tenant_id,
        organization_id,
        processed_by,
        result_status,
        result_payload,
        expires_at
    ) VALUES (
        p_idempotency_key,
        p_queue_name,
        p_job_name,
        p_job_data_hash,
        p_tenant_id,
        p_organization_id,
        p_processed_by,
        p_result_status,
        p_result_payload,
        now() + (p_ttl_hours || ' hours')::interval
    )
    ON CONFLICT (idempotency_key, queue_name) 
    DO UPDATE SET
        processed_at = now(),
        processed_by = p_processed_by,
        result_status = p_result_status,
        result_payload = p_result_payload,
        expires_at = now() + (p_ttl_hours || ' hours')::interval
    RETURNING id INTO record_id;
    
    RETURN record_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_job_processed(text, text, text, text, text, text, text, text, jsonb, integer) TO service_role;

COMMIT;
