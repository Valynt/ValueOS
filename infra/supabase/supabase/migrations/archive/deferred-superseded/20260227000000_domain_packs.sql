-- ============================================================================
-- Domain Packs: Industry-specific KPI and financial assumption overlays
-- ============================================================================

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. domain_packs — Pack metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.domain_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,                          -- NULL = system-provided pack, non-NULL = tenant-custom
    name TEXT NOT NULL,
    slug TEXT NOT NULL,                       -- e.g. 'banking', 'saas', 'manufacturing'
    industry TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL DEFAULT '1.0.0',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'draft', 'archived')),
    glossary JSONB DEFAULT '{}'::JSONB,      -- term → industry-specific label mapping
    narrative_templates JSONB DEFAULT '{}'::JSONB,
    compliance_rules JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT domain_packs_slug_version_unique UNIQUE (slug, version, tenant_id)
);

COMMENT ON TABLE public.domain_packs IS 'Industry-specific overlay packs for value case KPIs and financial assumptions';
COMMENT ON COLUMN public.domain_packs.tenant_id IS 'NULL for system packs available to all tenants; set for tenant-custom packs';

-- ============================================================================
-- 2. domain_pack_kpis — KPI definitions per pack
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.domain_pack_kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES public.domain_packs(id) ON DELETE CASCADE,
    kpi_key TEXT NOT NULL,                   -- e.g. 'cac_payback', 'nii_expansion'
    default_name TEXT NOT NULL,              -- display name
    description TEXT,
    unit TEXT,                               -- e.g. 'USD', 'months', '%'
    direction TEXT DEFAULT 'up'
        CHECK (direction IN ('up', 'down', 'neutral')),
    category TEXT,                           -- e.g. 'Revenue', 'Cost', 'Risk', 'Efficiency'
    baseline_hint TEXT,                      -- placeholder text for UI: "Typical: $2M-$5M"
    target_hint TEXT,                        -- placeholder text for UI: "Top quartile: 15%"
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT domain_pack_kpis_pack_key_unique UNIQUE (pack_id, kpi_key)
);

COMMENT ON TABLE public.domain_pack_kpis IS 'KPI definitions within a domain pack — the semantic layer overlay';

-- ============================================================================
-- 3. domain_pack_assumptions — Financial assumption defaults per pack
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.domain_pack_assumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES public.domain_packs(id) ON DELETE CASCADE,
    assumption_key TEXT NOT NULL,             -- e.g. 'discount_rate', 'payback_tolerance_months'
    display_name TEXT NOT NULL,
    description TEXT,
    value_type TEXT NOT NULL DEFAULT 'number'
        CHECK (value_type IN ('number', 'bool', 'text')),
    value_number NUMERIC,
    value_bool BOOLEAN,
    value_text TEXT,
    unit TEXT,                               -- e.g. '%', 'months', 'USD'
    category TEXT,                           -- e.g. 'Financial', 'Risk', 'Compliance'
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT domain_pack_assumptions_pack_key_unique UNIQUE (pack_id, assumption_key)
);

COMMENT ON TABLE public.domain_pack_assumptions IS 'Financial assumption defaults within a domain pack';

-- ============================================================================
-- 4. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_domain_packs_tenant ON public.domain_packs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_domain_packs_slug ON public.domain_packs(slug);
CREATE INDEX IF NOT EXISTS idx_domain_packs_status ON public.domain_packs(status);
CREATE INDEX IF NOT EXISTS idx_domain_pack_kpis_pack ON public.domain_pack_kpis(pack_id);
CREATE INDEX IF NOT EXISTS idx_domain_pack_assumptions_pack ON public.domain_pack_assumptions(pack_id);

-- ============================================================================
-- 5. Updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_domain_packs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_domain_packs_updated_at ON public.domain_packs;
CREATE TRIGGER trg_domain_packs_updated_at
    BEFORE UPDATE ON public.domain_packs
    FOR EACH ROW EXECUTE FUNCTION public.update_domain_packs_updated_at();

-- ============================================================================
-- 6. Value Case integration — add domain_pack_id FK
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'value_cases'
          AND column_name = 'domain_pack_id'
    ) THEN
        ALTER TABLE public.value_cases
            ADD COLUMN domain_pack_id UUID REFERENCES public.domain_packs(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_value_cases_domain_pack ON public.value_cases(domain_pack_id);

-- ============================================================================
-- 7. KPI Hypotheses provenance — add origin column
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'kpi_hypotheses'
          AND column_name = 'origin'
    ) THEN
        ALTER TABLE public.kpi_hypotheses
            ADD COLUMN origin TEXT DEFAULT 'manual'
                CHECK (origin IN ('manual', 'domain_pack', 'agent'));
    END IF;
END $$;

-- ============================================================================
-- 8. RLS Policies
-- ============================================================================

ALTER TABLE public.domain_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_pack_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_pack_assumptions ENABLE ROW LEVEL SECURITY;

-- domain_packs: visible if system pack (tenant_id IS NULL) or tenant matches
DROP POLICY IF EXISTS domain_packs_select_policy ON public.domain_packs;
CREATE POLICY domain_packs_select_policy ON public.domain_packs
    FOR SELECT USING (
        tenant_id IS NULL
        OR security.user_has_tenant_access(tenant_id)
    );

DROP POLICY IF EXISTS domain_packs_insert_policy ON public.domain_packs;
CREATE POLICY domain_packs_insert_policy ON public.domain_packs
    FOR INSERT WITH CHECK (
        security.user_has_tenant_access(tenant_id)
    );

DROP POLICY IF EXISTS domain_packs_update_policy ON public.domain_packs;
CREATE POLICY domain_packs_update_policy ON public.domain_packs
    FOR UPDATE USING (
        security.user_has_tenant_access(tenant_id)
    );

-- domain_pack_kpis: accessible if the parent pack is accessible
DROP POLICY IF EXISTS domain_pack_kpis_select_policy ON public.domain_pack_kpis;
CREATE POLICY domain_pack_kpis_select_policy ON public.domain_pack_kpis
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.domain_packs dp
            WHERE dp.id = pack_id
              AND (dp.tenant_id IS NULL OR security.user_has_tenant_access(dp.tenant_id))
        )
    );

DROP POLICY IF EXISTS domain_pack_kpis_insert_policy ON public.domain_pack_kpis;
CREATE POLICY domain_pack_kpis_insert_policy ON public.domain_pack_kpis
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.domain_packs dp
            WHERE dp.id = pack_id
              AND security.user_has_tenant_access(dp.tenant_id)
        )
    );

-- domain_pack_assumptions: same pattern
DROP POLICY IF EXISTS domain_pack_assumptions_select_policy ON public.domain_pack_assumptions;
CREATE POLICY domain_pack_assumptions_select_policy ON public.domain_pack_assumptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.domain_packs dp
            WHERE dp.id = pack_id
              AND (dp.tenant_id IS NULL OR security.user_has_tenant_access(dp.tenant_id))
        )
    );

DROP POLICY IF EXISTS domain_pack_assumptions_insert_policy ON public.domain_pack_assumptions;
CREATE POLICY domain_pack_assumptions_insert_policy ON public.domain_pack_assumptions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.domain_packs dp
            WHERE dp.id = pack_id
              AND security.user_has_tenant_access(dp.tenant_id)
        )
    );
