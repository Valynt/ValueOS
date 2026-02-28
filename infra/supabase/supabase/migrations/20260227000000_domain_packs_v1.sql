-- Domain Packs v1: Complete Database Schema (Hardened)
-- Normalized layers + proper multi-tenant RLS

BEGIN;

-- =====================================================
-- 0. Helper: current_tenant_id() from JWT
-- Assumes tenant_id stored in JWT app_metadata.tenant_id
-- Adjust path if using user_metadata or custom claim.
-- =====================================================

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
$$;

-- =====================================================
-- 1. Core Domain Packs Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.domain_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID, -- NULL = global pack, UUID = tenant-specific
    name TEXT NOT NULL,
    industry TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'deprecated')),
    parent_pack_id UUID REFERENCES public.domain_packs(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT version_format_check
        CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$')
);

CREATE INDEX IF NOT EXISTS idx_domain_packs_tenant
    ON public.domain_packs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_domain_packs_industry_status
    ON public.domain_packs (industry, status);

-- =====================================================
-- 2. KPI Overlay Layer
-- =====================================================

CREATE TABLE IF NOT EXISTS public.domain_pack_kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_pack_id UUID NOT NULL
        REFERENCES public.domain_packs(id)
        ON DELETE CASCADE,
    kpi_key TEXT NOT NULL, -- e.g., 'cost_to_serve'
    default_name TEXT NOT NULL,
    description TEXT,
    unit TEXT, -- '%', '$', 'hrs', 'bps'
    direction TEXT
        CHECK (direction IN ('increase', 'decrease')),
    baseline_hint TEXT,
    target_hint TEXT,
    default_confidence NUMERIC(5,4) NOT NULL DEFAULT 0.80
        CHECK (default_confidence >= 0 AND default_confidence <= 1),
    sort_order INTEGER NOT NULL DEFAULT 0,
    tags TEXT[],

    UNIQUE(domain_pack_id, kpi_key)
);

CREATE INDEX IF NOT EXISTS idx_domain_pack_kpis_pack
    ON public.domain_pack_kpis (domain_pack_id);

-- =====================================================
-- 3. Financial Assumptions Layer
-- =====================================================

CREATE TABLE IF NOT EXISTS public.domain_pack_assumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_pack_id UUID NOT NULL
        REFERENCES public.domain_packs(id)
        ON DELETE CASCADE,
    assumption_key TEXT NOT NULL, -- e.g., 'discount_rate'
    value_type TEXT NOT NULL
        CHECK (value_type IN ('number', 'string', 'boolean', 'json')),
    value_number NUMERIC,
    value_text TEXT,
    value_bool BOOLEAN,
    value_json JSONB,
    unit TEXT, -- 'years', '%', etc.
    default_confidence NUMERIC(5,4) NOT NULL DEFAULT 0.90
        CHECK (default_confidence >= 0 AND default_confidence <= 1),
    rationale TEXT,
    evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,

    UNIQUE(domain_pack_id, assumption_key),

    CONSTRAINT value_type_enforcement CHECK (
        (value_type = 'number'  AND value_number IS NOT NULL AND value_text IS NULL AND value_bool IS NULL)
     OR (value_type = 'string'  AND value_text IS NOT NULL  AND value_number IS NULL AND value_bool IS NULL)
     OR (value_type = 'boolean' AND value_bool IS NOT NULL  AND value_number IS NULL AND value_text IS NULL)
     OR (value_type = 'json'    AND value_json IS NOT NULL  AND value_number IS NULL AND value_text IS NULL AND value_bool IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_domain_pack_assumptions_pack
    ON public.domain_pack_assumptions (domain_pack_id);

-- =====================================================
-- 4. Value Case Integration
-- =====================================================

ALTER TABLE public.value_cases
ADD COLUMN IF NOT EXISTS domain_pack_id UUID
    REFERENCES public.domain_packs(id)
    ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS domain_pack_version TEXT,
ADD COLUMN IF NOT EXISTS domain_pack_snapshot JSONB;

-- Enforce version snapshot if pack is selected
ALTER TABLE public.value_cases
ADD CONSTRAINT value_cases_pack_version_required
CHECK (
    domain_pack_id IS NULL
    OR domain_pack_version IS NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_value_cases_domain_pack
    ON public.value_cases (domain_pack_id);

-- =====================================================
-- 5. updated_at Trigger
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_domain_packs_updated_at
    ON public.domain_packs;

CREATE TRIGGER trg_domain_packs_updated_at
BEFORE UPDATE ON public.domain_packs
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- =====================================================
-- 6. Row Level Security (RLS)
-- =====================================================

ALTER TABLE public.domain_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_pack_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_pack_assumptions ENABLE ROW LEVEL SECURITY;

-- -------------------------
-- READ POLICIES
-- -------------------------

-- Global packs (tenant_id IS NULL) readable by all tenants
-- Tenant packs readable only by matching tenant
CREATE POLICY domain_packs_select_policy
ON public.domain_packs
FOR SELECT
USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
);

CREATE POLICY domain_pack_kpis_select_policy
ON public.domain_pack_kpis
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.domain_packs p
        WHERE p.id = domain_pack_kpis.domain_pack_id
        AND (
            p.tenant_id IS NULL
            OR p.tenant_id = public.current_tenant_id()
        )
    )
);

CREATE POLICY domain_pack_assumptions_select_policy
ON public.domain_pack_assumptions
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.domain_packs p
        WHERE p.id = domain_pack_assumptions.domain_pack_id
        AND (
            p.tenant_id IS NULL
            OR p.tenant_id = public.current_tenant_id()
        )
    )
);

-- -------------------------
-- WRITE POLICIES (Tenant-only; adjust for admin role if needed)
-- -------------------------

CREATE POLICY domain_packs_write_policy
ON public.domain_packs
FOR ALL
USING (
    tenant_id = public.current_tenant_id()
)
WITH CHECK (
    tenant_id = public.current_tenant_id()
);

CREATE POLICY domain_pack_kpis_write_policy
ON public.domain_pack_kpis
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.domain_packs p
        WHERE p.id = domain_pack_kpis.domain_pack_id
        AND p.tenant_id = public.current_tenant_id()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.domain_packs p
        WHERE p.id = domain_pack_kpis.domain_pack_id
        AND p.tenant_id = public.current_tenant_id()
    )
);

CREATE POLICY domain_pack_assumptions_write_policy
ON public.domain_pack_assumptions
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.domain_packs p
        WHERE p.id = domain_pack_assumptions.domain_pack_id
        AND p.tenant_id = public.current_tenant_id()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.domain_packs p
        WHERE p.id = domain_pack_assumptions.domain_pack_id
        AND p.tenant_id = public.current_tenant_id()
    )
);

COMMIT;
