-- Add composite indexes for high-volume tables

BEGIN;

-- llm_usage index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_llm_usage_tenant_created
ON public.llm_usage (tenant_id, created_at)
WHERE deleted_at IS NULL;

-- user_sessions index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_tenant_user
ON public.user_sessions (tenant_id, user_id)
WHERE expired_at IS NULL;

-- transactions index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_tenant_created
ON public.transactions (tenant_id, created_at)
WHERE status = 'completed';

COMMIT;
