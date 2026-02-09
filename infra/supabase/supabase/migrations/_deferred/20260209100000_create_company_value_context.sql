-- Migration: Company Value Context
-- The persistent company intelligence layer that turns generic agents into
-- company-specific value strategists. Created once per tenant during onboarding,
-- consumed by all downstream hypothesis, model, and narrative generation.

-- ============================================
-- 1. company_contexts — the root object per tenant
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    website_url TEXT,
    industry TEXT,
    company_size TEXT CHECK (company_size IN ('smb', 'mid_market', 'enterprise')),
    sales_motion TEXT CHECK (sales_motion IN ('new_logo', 'expansion', 'land_and_expand', 'renewal')),
    annual_revenue TEXT,
    employee_count INTEGER,
    onboarding_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (onboarding_status IN ('pending', 'in_progress', 'completed', 'needs_refresh')),
    onboarding_completed_at TIMESTAMPTZ,
    narrative_doctrine JSONB DEFAULT '{}'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_company_contexts_tenant UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_company_contexts_tenant ON public.company_contexts(tenant_id);

-- ============================================
-- 2. company_products — what the company sells
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    context_id UUID NOT NULL REFERENCES public.company_contexts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    product_type TEXT CHECK (product_type IN ('platform', 'module', 'service', 'add_on')),
    target_industries TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_products_tenant ON public.company_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_products_context ON public.company_products(context_id);

-- ============================================
-- 3. company_capabilities — what the products enable (not features)
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    product_id UUID NOT NULL REFERENCES public.company_products(id) ON DELETE CASCADE,
    capability TEXT NOT NULL,
    operational_change TEXT,
    economic_lever TEXT,
    confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_capabilities_tenant ON public.company_capabilities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_capabilities_product ON public.company_capabilities(product_id);

-- ============================================
-- 4. company_competitors — named competitive landscape
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    context_id UUID NOT NULL REFERENCES public.company_contexts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    website_url TEXT,
    relationship TEXT CHECK (relationship IN ('direct', 'indirect', 'incumbent', 'emerging')),
    differentiated_claims TEXT[] DEFAULT '{}',
    commodity_claims TEXT[] DEFAULT '{}',
    risky_claims TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_competitors_tenant ON public.company_competitors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_competitors_context ON public.company_competitors(context_id);

-- ============================================
-- 5. company_personas — buyer personas and ICPs
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    context_id UUID NOT NULL REFERENCES public.company_contexts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    persona_type TEXT CHECK (persona_type IN ('decision_maker', 'champion', 'influencer', 'end_user', 'blocker')),
    seniority TEXT CHECK (seniority IN ('c_suite', 'vp', 'director', 'manager', 'individual_contributor')),
    typical_kpis TEXT[] DEFAULT '{}',
    pain_points TEXT[] DEFAULT '{}',
    success_metrics TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_personas_tenant ON public.company_personas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_personas_context ON public.company_personas(context_id);

-- ============================================
-- 6. company_value_patterns — reusable [industry + persona + capability] → KPIs
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_value_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    context_id UUID NOT NULL REFERENCES public.company_contexts(id) ON DELETE CASCADE,
    pattern_name TEXT NOT NULL,
    industry TEXT,
    persona_id UUID REFERENCES public.company_personas(id) ON DELETE SET NULL,
    capability_id UUID REFERENCES public.company_capabilities(id) ON DELETE SET NULL,
    typical_kpis JSONB DEFAULT '[]'::JSONB,
    typical_assumptions JSONB DEFAULT '[]'::JSONB,
    typical_value_range JSONB DEFAULT '{}'::JSONB,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_value_patterns_tenant ON public.company_value_patterns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_value_patterns_context ON public.company_value_patterns(context_id);

-- ============================================
-- 7. company_claim_governance — risk classification for claims
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_claim_governance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    context_id UUID NOT NULL REFERENCES public.company_contexts(id) ON DELETE CASCADE,
    claim_text TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('safe', 'conditional', 'high_risk')),
    category TEXT CHECK (category IN ('revenue', 'cost', 'risk', 'productivity', 'compliance')),
    rationale TEXT,
    required_evidence_tier TEXT CHECK (required_evidence_tier IN ('tier_1', 'tier_2', 'tier_3')),
    auto_flag BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_claim_governance_tenant ON public.company_claim_governance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_claim_governance_context ON public.company_claim_governance(context_id);

-- ============================================
-- 8. company_context_versions — audit trail for context changes
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_context_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id UUID NOT NULL REFERENCES public.company_contexts(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    changed_by UUID,
    change_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_context_versions_context ON public.company_context_versions(context_id);
CREATE INDEX IF NOT EXISTS idx_company_context_versions_tenant ON public.company_context_versions(tenant_id);

-- ============================================
-- RLS: Enable and enforce on all tables
-- ============================================
ALTER TABLE public.company_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_contexts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_capabilities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_competitors FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_personas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_value_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_value_patterns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_claim_governance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_claim_governance FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_context_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_context_versions FORCE ROW LEVEL SECURITY;

-- RLS policies using canonical tenant access function
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'company_contexts', 'company_products', 'company_capabilities',
        'company_competitors', 'company_personas', 'company_value_patterns',
        'company_claim_governance', 'company_context_versions'
    ] LOOP
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT USING (security.user_has_tenant_access(tenant_id))',
            tbl || '_select', tbl
        );
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id))',
            tbl || '_insert', tbl
        );
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR UPDATE USING (security.user_has_tenant_access(tenant_id))',
            tbl || '_update', tbl
        );
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR DELETE USING (security.user_has_tenant_access(tenant_id))',
            tbl || '_delete', tbl
        );
    END LOOP;
END;
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'company_contexts', 'company_products', 'company_capabilities',
        'company_competitors', 'company_personas', 'company_value_patterns',
        'company_claim_governance'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
            'trg_' || tbl || '_updated_at', tbl
        );
    END LOOP;
END;
$$;
