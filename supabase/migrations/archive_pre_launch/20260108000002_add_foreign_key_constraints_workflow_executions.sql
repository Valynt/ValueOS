-- Add missing foreign key constraints to workflow_executions table
-- This fixes critical referential integrity issues and ensures data consistency

BEGIN;

-- Add foreign key constraint for session_id to agent_sessions
ALTER TABLE public.workflow_executions
ADD CONSTRAINT fk_workflow_executions_session_id
FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;

-- Add foreign key constraint for tenant_id if column exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'workflow_executions'
               AND column_name = 'tenant_id'
               AND table_schema = 'public') THEN
        ALTER TABLE public.workflow_executions
        ADD CONSTRAINT fk_workflow_executions_tenant_id
        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint for user_id to users
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'workflow_executions'
               AND column_name = 'user_id'
               AND table_schema = 'public') THEN
        ALTER TABLE public.workflow_executions
        ADD CONSTRAINT fk_workflow_executions_user_id
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint for organization_id to organizations
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'workflow_executions'
               AND column_name = 'organization_id'
               AND table_schema = 'public') THEN
        ALTER TABLE public.workflow_executions
        ADD CONSTRAINT fk_workflow_executions_organization_id
        FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add performance indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_workflow_executions_session_id ON public.workflow_executions USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant_id ON public.workflow_executions USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON public.workflow_executions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_organization_id ON public.workflow_executions USING btree (organization_id);

COMMIT;