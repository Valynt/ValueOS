-- Migration: 20241229000000_hitl_tables.sql
-- Description: Create HITL tables for Approval Workflow Engine

-- Create HITL Requests table
CREATE TABLE IF NOT EXISTS public.hitl_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gate_id TEXT NOT NULL,
    organization_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'escalated', 'expired', 'auto_approved', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- JSON payloads for flexibility
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb, -- Includes data preview, action details
    approvals JSONB NOT NULL DEFAULT '[]'::jsonb,      -- Array of approvals
    rejections JSONB NOT NULL DEFAULT '[]'::jsonb,     -- Array of rejections
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb        -- Escalation level, audit tokens etc.
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_hitl_requests_org_id ON public.hitl_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_hitl_requests_status ON public.hitl_requests(status);
CREATE INDEX IF NOT EXISTS idx_hitl_requests_expires_at ON public.hitl_requests(expires_at) WHERE status = 'pending';

-- Enable Row Level Security
ALTER TABLE public.hitl_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1. Service Role (Agents) can do everything
CREATE POLICY "Service role full access" ON public.hitl_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Authenticated users can VIEW requests in their organization
-- Note: 'auth.uid()' check assumes organization mapping exists in a separate table or app_metadata
-- For now, we assume a simplified check or relying on service interactions.
-- In a real app, we'd join with user_roles or organizations.
-- This placeholder allows authenticated users to read.
CREATE POLICY "Authenticated users view org requests" ON public.hitl_requests
    FOR SELECT
    TO authenticated
    USING (true); -- Refine this in VOS-SEC-002 refinement if needed

-- 3. Users cannot INSERT/UPDATE directly (must go through Agent API)
-- Only service_role creates requests.

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_hitl_requests_updated_at
    BEFORE UPDATE ON public.hitl_requests
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
