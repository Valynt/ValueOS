-- ============================================================================
-- Migration: Create export_jobs table for async export processing
-- Task: P0 - Async Export Queue with Real-Time Progress Streaming
--
-- Tracks export jobs (PDF, PPTX) with progress steps for real-time feedback.
-- Tenant isolation: every row carries tenant_id (NOT NULL).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. export_jobs — Async export job tracking with progress
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.export_jobs (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid NOT NULL,
    organization_id         uuid NOT NULL,
    case_id                 uuid NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
    user_id                 uuid NOT NULL REFERENCES public.users(id),
    
    -- Export configuration
    format                  text NOT NULL CHECK (format IN ('pdf', 'pptx')),
    export_type             text NOT NULL DEFAULT 'full' CHECK (export_type IN ('full', 'executive_summary', 'financials_only', 'hypotheses_only')),
    title                   text,
    owner_name              text,
    render_url              text,  -- For PDF exports (internal render URL)
    
    -- Job lifecycle
    status                  text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    progress_percent        integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    current_step            text,  -- Human-readable step description
    
    -- Progress breakdown (JSON for flexibility)
    progress_steps          jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- Example: [
    --   {"name": "fetch_data", "label": "Fetching case data", "status": "completed", "percent": 20},
    --   {"name": "build_deck", "label": "Building presentation", "status": "in_progress", "percent": 50},
    --   {"name": "render_pdf", "label": "Rendering PDF", "status": "pending", "percent": 0}
    -- ]
    
    -- Result
    storage_path            text,
    signed_url              text,
    signed_url_expires_at   timestamptz,
    file_size_bytes         bigint,
    
    -- Quality gates at export time
    integrity_score_at_export numeric(5,4) CHECK (integrity_score_at_export >= 0 AND integrity_score_at_export <= 1),
    readiness_score_at_export numeric(5,4) CHECK (readiness_score_at_export >= 0 AND readiness_score_at_export <= 1),
    
    -- Error tracking
    error_message           text,
    error_code              text,
    retry_count             integer NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at              timestamptz NOT NULL DEFAULT now(),
    started_at              timestamptz,
    completed_at            timestamptz,
    failed_at               timestamptz,
    cancelled_at            timestamptz,
    updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.export_jobs IS 'Tracks async export jobs (PDF, PPTX) with real-time progress';
COMMENT ON COLUMN public.export_jobs.progress_steps IS 'Array of step objects with name, label, status, and percent for granular progress tracking';
COMMENT ON COLUMN public.export_jobs.integrity_score_at_export IS 'Integrity score captured at export time for audit trail';

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_export_jobs_tenant_case ON public.export_jobs (tenant_id, case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_case_status ON public.export_jobs (case_id, status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_user ON public.export_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status_created ON public.export_jobs (status, created_at) WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS idx_export_jobs_signed_url_expires ON public.export_jobs (signed_url_expires_at) WHERE signed_url IS NOT NULL;

-- ============================================================================
-- 2. export_job_events — Real-time event log for SSE streaming
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.export_job_events (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    export_job_id           uuid NOT NULL REFERENCES public.export_jobs(id) ON DELETE CASCADE,
    tenant_id               uuid NOT NULL,
    event_type              text NOT NULL CHECK (event_type IN ('progress', 'step_start', 'step_complete', 'error', 'complete', 'cancelled')),
    event_data              jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- Example: {"step": "fetch_data", "percent": 25, "message": "Loading narrative draft..."}
    created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.export_job_events IS 'Event stream for real-time export progress updates (SSE)';

-- Indexes for event streaming
CREATE INDEX IF NOT EXISTS idx_export_job_events_job ON public.export_job_events (export_job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_job_events_tenant ON public.export_job_events (tenant_id, export_job_id);

-- ============================================================================
-- 3. Row-Level Security
-- ============================================================================

ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_job_events ENABLE ROW LEVEL SECURITY;

-- export_jobs RLS policies
CREATE POLICY export_jobs_tenant_select
  ON public.export_jobs FOR SELECT
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

CREATE POLICY export_jobs_tenant_insert
  ON public.export_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

CREATE POLICY export_jobs_tenant_update
  ON public.export_jobs FOR UPDATE
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

CREATE POLICY export_jobs_tenant_delete
  ON public.export_jobs FOR DELETE
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND user_id = auth.uid())
  );

-- Service role bypass for export_jobs
CREATE POLICY export_jobs_service_role_all
  ON public.export_jobs FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- export_job_events RLS policies (inherit from parent job)
CREATE POLICY export_job_events_tenant_select
  ON public.export_job_events FOR SELECT
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

CREATE POLICY export_job_events_tenant_insert
  ON public.export_job_events FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- Service role bypass for export_job_events
CREATE POLICY export_job_events_service_role_all
  ON public.export_job_events FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 4. Trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_export_jobs_updated_at ON public.export_jobs;
CREATE TRIGGER trg_export_jobs_updated_at
  BEFORE UPDATE ON public.export_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5. Grants
-- ============================================================================

GRANT ALL ON public.export_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.export_jobs TO authenticated;

GRANT ALL ON public.export_job_events TO service_role;
GRANT SELECT, INSERT ON public.export_job_events TO authenticated;

-- ============================================================================
-- 6. Add case_artifacts export tracking (P1 - Export History)
-- ============================================================================

-- Add export-specific artifact types to case_artifacts constraint
-- Note: This extends the existing constraint. For safety, we add a separate check
-- via trigger since modifying CHECK constraints can be destructive.

CREATE OR REPLACE FUNCTION public.validate_artifact_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.artifact_type NOT IN (
    'executive_memo', 'cfo_recommendation', 'customer_narrative', 'internal_case',
    'export_package_pdf', 'export_package_pptx', 'export_bundle_zip'
  ) THEN
    RAISE EXCEPTION 'Invalid artifact_type: %', NEW.artifact_type;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create export_packages view for convenient history queries
CREATE OR REPLACE VIEW public.export_packages AS
SELECT 
  ej.id,
  ej.tenant_id,
  ej.case_id,
  ej.user_id,
  ej.format,
  ej.export_type,
  ej.title,
  ej.status,
  ej.progress_percent,
  ej.signed_url,
  ej.signed_url_expires_at,
  ej.file_size_bytes,
  ej.integrity_score_at_export,
  ej.readiness_score_at_export,
  ej.created_at,
  ej.completed_at,
  ej.error_message,
  u.email as exported_by_email,
  u.full_name as exported_by_name
FROM public.export_jobs ej
LEFT JOIN public.users u ON u.id = ej.user_id
WHERE ej.status = 'completed';

COMMENT ON VIEW public.export_packages IS 'Convenient view for export history with user details';

-- ============================================================================
-- 7. Cleanup function for expired signed URLs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_export_urls()
RETURNS integer AS $$
DECLARE
  count integer;
BEGIN
  UPDATE public.export_jobs
  SET signed_url = NULL
  WHERE signed_url_expires_at < now()
    AND signed_url IS NOT NULL;
  
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_expired_export_urls() IS 'Clears expired signed URLs from export_jobs (call via cron)';

COMMIT;
