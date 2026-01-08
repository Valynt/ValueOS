-- Add tenant_id column to value_cases table for proper multi-tenant isolation
-- This fixes the critical issue of missing tenant isolation in business case data

BEGIN;

-- Add tenant_id column
ALTER TABLE public.value_cases ADD COLUMN tenant_id text;

-- Populate tenant_id from associated agent sessions
UPDATE public.value_cases
SET tenant_id = agent_sessions.tenant_id
FROM public.agent_sessions
WHERE public.value_cases.session_id = agent_sessions.id;

-- Make tenant_id NOT NULL after populating data
ALTER TABLE public.value_cases ALTER COLUMN tenant_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.value_cases
ADD CONSTRAINT fk_value_cases_tenant_id
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_value_cases_tenant_id ON public.value_cases USING btree (tenant_id);

-- Add RLS policy for tenant isolation
DROP POLICY IF EXISTS "value_cases_tenant_isolation" ON public.value_cases;
CREATE POLICY "value_cases_tenant_isolation" ON public.value_cases
FOR ALL USING (tenant_id = (SELECT NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id'), '')::text));

-- Enable RLS
ALTER TABLE public.value_cases ENABLE ROW LEVEL SECURITY;

COMMIT;