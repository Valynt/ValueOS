-- Migration: Saga Infrastructure
-- Description: Adds tables and indexes to support the Value Case Saga and Integrity Engine.

-- 1. Saga Transitions History Table
CREATE TABLE IF NOT EXISTS public.saga_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    value_case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    from_state VARCHAR(50) NOT NULL,
    to_state VARCHAR(50) NOT NULL,
    trigger VARCHAR(100) NOT NULL,
    agent_id VARCHAR(255),
    correlation_id UUID NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_saga_transitions_case_id ON public.saga_transitions(value_case_id);
CREATE INDEX IF NOT EXISTS idx_saga_transitions_correlation_id ON public.saga_transitions(correlation_id);

-- 2. Evidence Items Table
CREATE TABLE IF NOT EXISTS public.evidence_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    value_case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    content TEXT NOT NULL,
    tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
    weight DECIMAL(3, 2) NOT NULL,
    retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_case_org ON public.evidence_items(value_case_id, organization_id);

-- 3. Provenance Records Table
-- Already exists in some form as agent_memory, but we want a dedicated view or table for lineage if needed.
-- For R8, we'll use agent_memory with memory_type: 'provenance', but adding a helper table for faster lineage lookup.
CREATE TABLE IF NOT EXISTS public.provenance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    value_case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    claim_id VARCHAR(255) NOT NULL,
    data_source TEXT NOT NULL,
    evidence_tier INTEGER NOT NULL CHECK (evidence_tier IN (1, 2, 3)),
    formula TEXT,
    agent_id VARCHAR(255) NOT NULL,
    agent_version VARCHAR(50) NOT NULL,
    confidence_score DECIMAL(3, 2) NOT NULL,
    parent_record_id UUID REFERENCES public.provenance_records(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_provenance_records_case_claim ON public.provenance_records(value_case_id, claim_id);

-- Enable RLS on new tables
ALTER TABLE public.saga_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provenance_records ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies (tenant-scoped)
CREATE POLICY "Saga transitions are tenant-scoped" ON public.saga_transitions
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.cases
            WHERE cases.id = saga_transitions.value_case_id
            AND cases.organization_id::text = ANY(public.get_user_tenant_ids(auth.uid()))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.cases
            WHERE cases.id = saga_transitions.value_case_id
            AND cases.organization_id::text = ANY(public.get_user_tenant_ids(auth.uid()))
        )
    );

CREATE POLICY saga_transitions_service_role ON public.saga_transitions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Evidence items are tenant-scoped" ON public.evidence_items
    FOR ALL TO authenticated USING (organization_id::text = ANY(public.get_user_tenant_ids(auth.uid())))
    WITH CHECK (organization_id::text = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY evidence_items_service_role ON public.evidence_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Provenance records are tenant-scoped" ON public.provenance_records
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.cases
            WHERE cases.id = provenance_records.value_case_id
            AND cases.organization_id::text = ANY(public.get_user_tenant_ids(auth.uid()))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.cases
            WHERE cases.id = provenance_records.value_case_id
            AND cases.organization_id::text = ANY(public.get_user_tenant_ids(auth.uid()))
        )
    );

CREATE POLICY provenance_records_service_role ON public.provenance_records
    FOR ALL TO service_role USING (true) WITH CHECK (true);
