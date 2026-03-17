-- Migration: conversation_history tenant isolation
--
-- Creates the conversation_history table with tenant_id, enables RLS,
-- and adds the four standard tenant-scoped policies.
-- Resolves: ConversationHistoryService querying without tenant filter.

-- ============================================
-- 1. Create table
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT conversation_history_case_tenant_unique UNIQUE (case_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS conversation_history_tenant_id_idx
    ON public.conversation_history (tenant_id);

CREATE INDEX IF NOT EXISTS conversation_history_case_id_idx
    ON public.conversation_history (case_id);

-- ============================================
-- 2. Enable RLS
-- ============================================
ALTER TABLE public.conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_history FORCE ROW LEVEL SECURITY;

-- ============================================
-- 3. Standard tenant-scoped policies
-- ============================================
CREATE POLICY conversation_history_select
    ON public.conversation_history FOR SELECT
    USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY conversation_history_insert
    ON public.conversation_history FOR INSERT
    WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY conversation_history_update
    ON public.conversation_history FOR UPDATE
    USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY conversation_history_delete
    ON public.conversation_history FOR DELETE
    USING (security.user_has_tenant_access(tenant_id));

-- ============================================
-- 4. Role grants
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_history TO authenticated;
GRANT ALL ON public.conversation_history TO service_role;

-- ============================================
-- 5. updated_at trigger
-- ============================================
CREATE TRIGGER conversation_history_updated_at
    BEFORE UPDATE ON public.conversation_history
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
