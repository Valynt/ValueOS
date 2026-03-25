-- Add tenant_id to llm_job_results for DLQ traceability.
--
-- Without this column, failed jobs in BullMQ's failed-job store cannot be
-- attributed to a tenant, making replay and triage impossible without manual
-- Redis inspection. The column is nullable to avoid breaking existing rows;
-- new inserts from LLMQueueService always supply a value.

ALTER TABLE llm_job_results
  ADD COLUMN IF NOT EXISTS tenant_id text;

-- Index for per-tenant result queries and audit exports.
CREATE INDEX IF NOT EXISTS idx_llm_job_results_tenant_id
  ON llm_job_results (tenant_id);

COMMENT ON COLUMN llm_job_results.tenant_id IS
  'Tenant that submitted the job. Required for DLQ traceability and per-tenant audit.';
