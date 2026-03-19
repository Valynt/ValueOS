-- Create certificate_jobs table for tracking certificate generation jobs
-- Supports background job processing with status tracking

CREATE TABLE IF NOT EXISTS public.certificate_jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id text NOT NULL,
    organization_id text NOT NULL,
    user_id text NOT NULL,
    certification_id integer NOT NULL,
    format text NOT NULL CHECK (format IN ('pdf', 'png')),
    status text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    download_url text,
    certificate_blob text,
    error_message text,
    queued_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    failed_at timestamp with time zone,
    trace_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_certificate_jobs_tenant_user ON public.certificate_jobs(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_certificate_jobs_certification ON public.certificate_jobs(certification_id);
CREATE INDEX IF NOT EXISTS idx_certificate_jobs_status ON public.certificate_jobs(status);
CREATE INDEX IF NOT EXISTS idx_certificate_jobs_trace_id ON public.certificate_jobs(trace_id);

-- Enable RLS
ALTER TABLE public.certificate_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own certificate jobs
CREATE POLICY "Users can view their own certificate jobs"
ON public.certificate_jobs FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

-- Policy: Service role can manage all certificate jobs
CREATE POLICY "Service role full access to certificate_jobs"
ON public.certificate_jobs
TO service_role
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.certificate_jobs TO authenticated;
GRANT ALL ON public.certificate_jobs TO service_role;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_certificate_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_certificate_jobs_updated_at ON public.certificate_jobs;
CREATE TRIGGER update_certificate_jobs_updated_at
  BEFORE UPDATE ON public.certificate_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_certificate_jobs_updated_at();

COMMENT ON TABLE public.certificate_jobs IS 'Tracks certificate generation jobs processed by background worker';
COMMENT ON COLUMN public.certificate_jobs.id IS 'Primary key (UUID)';
COMMENT ON COLUMN public.certificate_jobs.tenant_id IS 'Tenant/organization ID for isolation';
COMMENT ON COLUMN public.certificate_jobs.certification_id IS 'Reference to certifications table';
COMMENT ON COLUMN public.certificate_jobs.status IS 'Job status: queued, running, completed, failed';
COMMENT ON COLUMN public.certificate_jobs.download_url IS 'URL to download generated certificate';
COMMENT ON COLUMN public.certificate_jobs.certificate_blob IS 'Base64-encoded certificate data (for backup)';
COMMENT ON COLUMN public.certificate_jobs.trace_id IS 'Distributed tracing ID for observability';
