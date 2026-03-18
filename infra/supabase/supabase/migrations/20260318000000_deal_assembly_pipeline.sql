-- Migration: Deal Assembly Pipeline Tables
-- Task: 2.1-2.7
-- Purpose: Create tables for deal context assembly from multiple sources

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2.1 deal_contexts table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deal_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    opportunity_id UUID NOT NULL,
    case_id UUID NULL,
    assembled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewing', 'approved', 'archived')),
    context_json JSONB NOT NULL DEFAULT '{}',
    source_summary TEXT,
    completeness_score NUMERIC(3,2) CHECK (completeness_score >= 0 AND completeness_score <= 1),
    value_driver_candidates JSONB DEFAULT '[]',
    missing_data_flags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 Indexes for deal_contexts
CREATE INDEX IF NOT EXISTS idx_deal_contexts_tenant_opportunity 
    ON public.deal_contexts(tenant_id, opportunity_id);
CREATE INDEX IF NOT EXISTS idx_deal_contexts_tenant_case 
    ON public.deal_contexts(tenant_id, case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deal_contexts_status 
    ON public.deal_contexts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_deal_contexts_assembled_at 
    ON public.deal_contexts(tenant_id, assembled_at DESC);

-- ============================================================================
-- 2.2 deal_context_sources table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deal_context_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    deal_context_id UUID NOT NULL REFERENCES public.deal_contexts(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN (
        'crm-opportunity', 'crm-account', 'crm-contact', 'call-transcript',
        'seller-notes', 'public-enrichment', 'user-upload', 'benchmark-reference'
    )),
    source_url TEXT,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fragment_hash TEXT NOT NULL,
    fragment_summary TEXT,
    data_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_context_sources_tenant_deal 
    ON public.deal_context_sources(tenant_id, deal_context_id);
CREATE INDEX IF NOT EXISTS idx_deal_context_sources_type 
    ON public.deal_context_sources(tenant_id, source_type);

-- ============================================================================
-- 2.3 stakeholders table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stakeholders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    deal_context_id UUID NOT NULL REFERENCES public.deal_contexts(id) ON DELETE CASCADE,
    opportunity_id UUID,
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    role TEXT NOT NULL CHECK (role IN (
        'economic_buyer', 'champion', 'technical_evaluator', 'end_user', 'blocker', 'influencer'
    )),
    influence_score NUMERIC(3,2) CHECK (influence_score >= 0 AND influence_score <= 1),
    priority INTEGER CHECK (priority >= 1 AND priority <= 100),
    source_type TEXT NOT NULL CHECK (source_type IN (
        'customer-confirmed', 'CRM-derived', 'call-derived', 'note-derived',
        'benchmark-derived', 'externally-researched', 'inferred', 'manually-overridden'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stakeholders_tenant_deal 
    ON public.stakeholders(tenant_id, deal_context_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_tenant_opportunity 
    ON public.stakeholders(tenant_id, opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stakeholders_role 
    ON public.stakeholders(tenant_id, role);

-- ============================================================================
-- 2.4 use_cases table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.use_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    deal_context_id UUID NOT NULL REFERENCES public.deal_contexts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    pain_signals JSONB DEFAULT '[]',
    priority INTEGER NOT NULL DEFAULT 50 CHECK (priority >= 1 AND priority <= 100),
    expected_outcomes JSONB DEFAULT '[]',
    source_type TEXT NOT NULL CHECK (source_type IN (
        'customer-confirmed', 'CRM-derived', 'call-derived', 'note-derived',
        'benchmark-derived', 'externally-researched', 'inferred', 'manually-overridden'
    )),
    value_driver_candidate BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_use_cases_tenant_deal 
    ON public.use_cases(tenant_id, deal_context_id);
CREATE INDEX IF NOT EXISTS idx_use_cases_priority 
    ON public.use_cases(tenant_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_use_cases_value_driver 
    ON public.use_cases(tenant_id, value_driver_candidate) WHERE value_driver_candidate = TRUE;

-- ============================================================================
-- 2.5 RLS Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.deal_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_contexts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deal_context_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_context_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stakeholders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.use_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.use_cases FORCE ROW LEVEL SECURITY;

-- deal_contexts policies
CREATE POLICY deal_contexts_tenant_access ON public.deal_contexts
    FOR ALL
    TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- deal_context_sources policies (scoped through deal_context)
CREATE POLICY deal_context_sources_tenant_access ON public.deal_context_sources
    FOR ALL
    TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- stakeholders policies
CREATE POLICY stakeholders_tenant_access ON public.stakeholders
    FOR ALL
    TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- use_cases policies
CREATE POLICY use_cases_tenant_access ON public.use_cases
    FOR ALL
    TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_deal_contexts_updated_at
    BEFORE UPDATE ON public.deal_contexts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stakeholders_updated_at
    BEFORE UPDATE ON public.stakeholders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_use_cases_updated_at
    BEFORE UPDATE ON public.use_cases
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.deal_contexts IS 'Assembled deal context from multiple sources for value case foundation';
COMMENT ON TABLE public.deal_context_sources IS 'Tracked sources that contributed to deal context assembly';
COMMENT ON TABLE public.stakeholders IS 'Stakeholders identified during deal assembly';
COMMENT ON TABLE public.use_cases IS 'Customer use cases extracted from deal signals';
