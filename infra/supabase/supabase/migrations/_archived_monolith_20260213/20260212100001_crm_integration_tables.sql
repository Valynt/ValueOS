-- ============================================================================
-- CRM Integration Tables
-- Adds tables for CRM connections, object mapping, webhook events,
-- stage triggers, provenance records, and value case templates.
-- ============================================================================

-- ============================================================================
-- 1. crm_connections — OAuth credentials and sync state per tenant+provider
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
    access_token_enc TEXT,          -- encrypted at application layer
    refresh_token_enc TEXT,         -- encrypted at application layer
    token_expires_at TIMESTAMPTZ,
    instance_url TEXT,              -- e.g. https://na1.salesforce.com
    external_org_id TEXT,           -- Salesforce org ID or HubSpot portal ID
    external_user_id TEXT,          -- user who authorized
    scopes TEXT[] DEFAULT '{}',
    sync_cursor TEXT,               -- provider-specific delta cursor
    last_sync_at TIMESTAMPTZ,
    last_successful_sync_at TIMESTAMPTZ,
    last_error JSONB,
    connected_by TEXT,              -- user_id who connected
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT crm_connections_provider_check
        CHECK (provider IN ('salesforce', 'hubspot')),
    CONSTRAINT crm_connections_status_check
        CHECK (status IN ('connected', 'disconnected', 'error', 'expired')),
    CONSTRAINT crm_connections_tenant_provider_unique
        UNIQUE (tenant_id, provider)
);

COMMENT ON TABLE public.crm_connections IS 'CRM OAuth connections per tenant. Tokens encrypted at app layer.';

-- ============================================================================
-- 2. crm_object_maps — external CRM ID ↔ internal ID mapping
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_object_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    object_type TEXT NOT NULL,       -- 'account', 'opportunity', 'contact'
    external_id TEXT NOT NULL,
    internal_table TEXT NOT NULL,     -- 'opportunities', 'value_cases', etc.
    internal_id UUID NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT crm_object_maps_provider_check
        CHECK (provider IN ('salesforce', 'hubspot')),
    CONSTRAINT crm_object_maps_unique
        UNIQUE (tenant_id, provider, object_type, external_id)
);

COMMENT ON TABLE public.crm_object_maps IS 'Maps CRM external IDs to internal ValueOS entity IDs.';

-- ============================================================================
-- 3. crm_webhook_events — idempotent webhook event store
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    process_status TEXT NOT NULL DEFAULT 'pending',
    last_error JSONB,

    CONSTRAINT crm_webhook_events_provider_check
        CHECK (provider IN ('salesforce', 'hubspot')),
    CONSTRAINT crm_webhook_events_status_check
        CHECK (process_status IN ('pending', 'processed', 'failed')),
    CONSTRAINT crm_webhook_events_idempotency_unique
        UNIQUE (idempotency_key)
);

COMMENT ON TABLE public.crm_webhook_events IS 'Stores CRM webhook events for idempotent processing.';

-- ============================================================================
-- 4. crm_stage_triggers — tenant-configurable stage-based triggers
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_stage_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    stage_name TEXT NOT NULL,        -- CRM stage name that triggers scaffolding
    action TEXT NOT NULL DEFAULT 'scaffold_value_case',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT crm_stage_triggers_provider_check
        CHECK (provider IN ('salesforce', 'hubspot')),
    CONSTRAINT crm_stage_triggers_unique
        UNIQUE (tenant_id, provider, stage_name)
);

COMMENT ON TABLE public.crm_stage_triggers IS 'Tenant-configurable CRM stage triggers for ValueCase scaffolding.';

-- ============================================================================
-- 5. provenance_records — lineage tracking for CRM-derived data
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.provenance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,       -- 'crm', 'agent', 'user', 'benchmark'
    source_provider TEXT,            -- 'salesforce', 'hubspot', etc.
    external_object_type TEXT,       -- 'opportunity', 'account', etc.
    external_object_id TEXT,
    internal_table TEXT NOT NULL,
    internal_id UUID NOT NULL,
    field_name TEXT,                 -- null = whole record, else specific field
    confidence_data_quality REAL,
    confidence_assumption_stability REAL,
    confidence_historical_alignment REAL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT provenance_records_source_check
        CHECK (source_type IN ('crm', 'agent', 'user', 'benchmark', 'system'))
);

COMMENT ON TABLE public.provenance_records IS 'Tracks data lineage for CRM-imported and agent-suggested data.';

-- ============================================================================
-- 6. value_case_templates — templates for scaffolding value cases
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.value_case_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.value_case_templates IS 'Templates for scaffolding new value cases from CRM opportunities.';

-- ============================================================================
-- 7. value_case_sagas — persistent saga state for value case lifecycle
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.value_case_sagas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    value_case_id UUID NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'INITIATED',
    previous_state TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    context JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT value_case_sagas_state_check
        CHECK (state IN ('INITIATED', 'DRAFTING', 'VALIDATING', 'COMPOSING', 'REFINING', 'FINALIZED')),
    CONSTRAINT value_case_sagas_value_case_unique
        UNIQUE (value_case_id)
);

COMMENT ON TABLE public.value_case_sagas IS 'Persistent state for the 6-phase ValueCase saga lifecycle.';

-- ============================================================================
-- 8. Add CRM-related columns to opportunities table
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'opportunities' AND column_name = 'external_crm_id') THEN
        ALTER TABLE public.opportunities
            ADD COLUMN external_crm_id TEXT,
            ADD COLUMN crm_provider TEXT,
            ADD COLUMN crm_stage TEXT,
            ADD COLUMN probability NUMERIC,
            ADD COLUMN close_date TIMESTAMPTZ,
            ADD COLUMN currency TEXT DEFAULT 'USD',
            ADD COLUMN owner_name TEXT,
            ADD COLUMN company_name TEXT,
            ADD COLUMN company_id TEXT,
            ADD COLUMN crm_properties JSONB DEFAULT '{}',
            ADD COLUMN last_crm_sync_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================================
-- 9. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_crm_connections_tenant_provider
    ON public.crm_connections (tenant_id, provider);

CREATE INDEX IF NOT EXISTS idx_crm_object_maps_tenant_lookup
    ON public.crm_object_maps (tenant_id, provider, object_type, external_id);

CREATE INDEX IF NOT EXISTS idx_crm_object_maps_internal
    ON public.crm_object_maps (internal_table, internal_id);

CREATE INDEX IF NOT EXISTS idx_crm_webhook_events_status
    ON public.crm_webhook_events (process_status, received_at);

CREATE INDEX IF NOT EXISTS idx_crm_webhook_events_tenant
    ON public.crm_webhook_events (tenant_id, provider);

CREATE INDEX IF NOT EXISTS idx_crm_stage_triggers_tenant
    ON public.crm_stage_triggers (tenant_id, provider, enabled);

CREATE INDEX IF NOT EXISTS idx_provenance_records_internal
    ON public.provenance_records (internal_table, internal_id);

CREATE INDEX IF NOT EXISTS idx_provenance_records_external
    ON public.provenance_records (source_provider, external_object_type, external_object_id);

CREATE INDEX IF NOT EXISTS idx_value_case_sagas_tenant
    ON public.value_case_sagas (tenant_id);

CREATE INDEX IF NOT EXISTS idx_value_case_sagas_state
    ON public.value_case_sagas (state);

CREATE INDEX IF NOT EXISTS idx_opportunities_external_crm
    ON public.opportunities (external_crm_id, crm_provider)
    WHERE external_crm_id IS NOT NULL;

-- ============================================================================
-- 10. RLS Policies
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE public.crm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_connections FORCE ROW LEVEL SECURITY;

ALTER TABLE public.crm_object_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_object_maps FORCE ROW LEVEL SECURITY;

ALTER TABLE public.crm_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_webhook_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.crm_stage_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stage_triggers FORCE ROW LEVEL SECURITY;

ALTER TABLE public.provenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provenance_records FORCE ROW LEVEL SECURITY;

ALTER TABLE public.value_case_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_case_templates FORCE ROW LEVEL SECURITY;

ALTER TABLE public.value_case_sagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_case_sagas FORCE ROW LEVEL SECURITY;

-- Apply standard tenant isolation policies to each table
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'crm_connections',
        'crm_object_maps',
        'crm_webhook_events',
        'crm_stage_triggers',
        'provenance_records',
        'value_case_templates',
        'value_case_sagas'
    ] LOOP
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON public.%I;', tbl);

        EXECUTE format(
            'CREATE POLICY tenant_isolation_select ON public.%I AS RESTRICTIVE FOR SELECT USING (security.user_has_tenant_access(tenant_id));',
            tbl
        );
        EXECUTE format(
            'CREATE POLICY tenant_isolation_insert ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id));',
            tbl
        );
        EXECUTE format(
            'CREATE POLICY tenant_isolation_update ON public.%I AS RESTRICTIVE FOR UPDATE USING (security.user_has_tenant_access(tenant_id)) WITH CHECK (security.user_has_tenant_access(tenant_id));',
            tbl
        );
        EXECUTE format(
            'CREATE POLICY tenant_isolation_delete ON public.%I AS RESTRICTIVE FOR DELETE USING (security.user_has_tenant_access(tenant_id));',
            tbl
        );
    END LOOP;
END $$;

-- ============================================================================
-- 11. Updated_at trigger function (reuse if exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'crm_connections',
        'crm_object_maps',
        'crm_stage_triggers',
        'value_case_templates',
        'value_case_sagas'
    ] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_%s_updated_at ON public.%I;',
            tbl, tbl
        );
        EXECUTE format(
            'CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
            tbl, tbl
        );
    END LOOP;
END $$;
