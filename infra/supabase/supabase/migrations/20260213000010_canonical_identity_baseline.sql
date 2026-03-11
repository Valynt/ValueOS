-- ============================================================================
-- Canonical identity and core-domain baseline
--
-- PURPOSE
-- -------
-- Active migrations (Sprint 10–15) depend on tables that were previously
-- created only by the archived monolith (_archived_monolith_20260213/).
-- A fresh database that applies only the active migration chain is missing
-- these tables, causing every subsequent migration to fail.
--
-- This migration makes the active chain self-consistent from a clean database.
-- It creates every load-bearing table that active migrations reference but
-- do not create themselves, using IF NOT EXISTS guards so it is safe to apply
-- against an existing database that already has these tables from the monolith.
--
-- TABLES CREATED
-- --------------
--   Identity / auth
--     tenants, user_tenants, memberships
--   Core product
--     value_cases, agent_memory
--   Billing (referenced by active billing migrations)
--     billing_customers, subscriptions, subscription_items, invoices,
--     usage_events, usage_aggregates, usage_quotas, usage_alerts,
--     webhook_events
--   Audit / compliance
--     audit_logs, audit_logs_archive, security_audit_log
--
-- SECURITY SCHEMA
-- ---------------
-- Also creates the security schema and security.user_has_tenant_access()
-- function that all active RLS policies depend on. IF NOT EXISTS guards
-- make this idempotent.
--
-- Rollback: 20260329000000_canonical_identity_baseline.rollback.sql
-- ============================================================================

SET search_path = public, pg_temp;

-- ============================================================================
-- 0. Security schema and RLS helper functions
--    All active RLS policies call security.user_has_tenant_access().
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS security;
CREATE SCHEMA IF NOT EXISTS app;

GRANT USAGE ON SCHEMA security TO authenticated;
GRANT USAGE ON SCHEMA security TO anon;

-- Reads tenant_id from app.tenant_id setting or JWT claims.
CREATE OR REPLACE FUNCTION security.current_tenant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.tenant_id', true), ''),
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id'),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')
  );
$$;

CREATE OR REPLACE FUNCTION security.current_tenant_id_uuid()
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT NULLIF(security.current_tenant_id(), '')::uuid;
$$;

-- UUID overload: primary tenant access check.
-- Verifies the authenticated user has an active row in user_tenants.
CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND target_tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_tenants AS ut
      WHERE ut.user_id   = (auth.uid())::text
        AND ut.tenant_id = target_tenant_id::text
        AND (ut.status IS NULL OR ut.status = 'active')
    );
$$;

-- TEXT overload: casts to UUID and delegates.
CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT security.user_has_tenant_access(target_tenant_id::uuid);
$$;

REVOKE ALL ON FUNCTION security.user_has_tenant_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION security.user_has_tenant_access(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.user_has_tenant_access(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION security.user_has_tenant_access(TEXT) TO anon, authenticated;

-- app schema helper used by value_commitment_tracking RLS.
CREATE OR REPLACE FUNCTION app.is_active_member(_tenant_id text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = _tenant_id
      AND m.user_id   = _user_id
      AND m.status    = 'active'
  );
$$;

-- Shared updated_at trigger function used by multiple tables.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 1. tenants
--    Root of the tenant hierarchy. tenant_id TEXT is the legacy identifier;
--    newer tables use organization_id UUID. Both reference this table.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id         text        NOT NULL,
  name       text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  settings   jsonb       DEFAULT '{}'::jsonb,
  status     text        DEFAULT 'active',
  CONSTRAINT tenants_pkey PRIMARY KEY (id),
  CONSTRAINT tenants_status_check CHECK (status = ANY (ARRAY['active','suspended','deleted']))
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants (status);

-- ============================================================================
-- 2. user_tenants
--    RLS authority: security.user_has_tenant_access() reads this table.
--    user_id is TEXT to match auth.uid()::text comparisons throughout.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_tenants (
  tenant_id  text        NOT NULL,
  user_id    text        NOT NULL,
  role       text        DEFAULT 'member',
  status     text        DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_tenants_pkey PRIMARY KEY (tenant_id, user_id),
  CONSTRAINT user_tenants_role_check   CHECK (role   = ANY (ARRAY['owner','admin','member','viewer'])),
  CONSTRAINT user_tenants_status_check CHECK (status = ANY (ARRAY['active','inactive']))
);

CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant  ON public.user_tenants (tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_user    ON public.user_tenants (user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_status  ON public.user_tenants (status);

ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own membership rows.
DROP POLICY IF EXISTS user_tenants_select ON public.user_tenants;
DROP POLICY IF EXISTS user_tenants_insert ON public.user_tenants;
DROP POLICY IF EXISTS user_tenants_update ON public.user_tenants;
DROP POLICY IF EXISTS user_tenants_delete ON public.user_tenants;

CREATE POLICY user_tenants_select ON public.user_tenants
  FOR SELECT USING (user_id = (auth.uid())::text);

CREATE POLICY user_tenants_insert ON public.user_tenants
  FOR INSERT WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY user_tenants_update ON public.user_tenants
  FOR UPDATE USING (user_id = (auth.uid())::text)
  WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY user_tenants_delete ON public.user_tenants
  FOR DELETE USING (user_id = (auth.uid())::text);

CREATE POLICY user_tenants_service_role ON public.user_tenants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tenants TO authenticated;
GRANT ALL ON public.user_tenants TO service_role;

-- ============================================================================
-- 3. memberships
--    RBAC graph root. membership_roles → role_permissions hang off this.
--    tenant_id TEXT matches user_tenants.tenant_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.memberships (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  text        NOT NULL,
  user_id    uuid        NOT NULL,
  status     text        NOT NULL DEFAULT 'active',
  is_owner   boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_status_check CHECK (status = ANY (ARRAY['active','invited','disabled'])),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant_user ON public.memberships (tenant_id, user_id);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY memberships_tenant_select ON public.memberships
  FOR SELECT USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY memberships_tenant_insert ON public.memberships
  FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY memberships_tenant_update ON public.memberships
  FOR UPDATE USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY memberships_service_role ON public.memberships
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;

-- ============================================================================
-- 4. value_cases
--    Central product entity. Carries both tenant_id (TEXT legacy) and
--    organization_id (UUID) for the transition period.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.value_cases (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid,
  tenant_id          text,
  session_id         uuid,
  name               text        NOT NULL,
  description        text,
  company_profile_id uuid,
  status             text        DEFAULT 'draft',
  stage              text        DEFAULT 'discovery',
  quality_score      double precision,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  metadata           jsonb       DEFAULT '{}'::jsonb,
  CONSTRAINT value_cases_status_check CHECK (
    status = ANY (ARRAY['draft','review','published','archived'])
  )
);

CREATE INDEX IF NOT EXISTS idx_value_cases_tenant_id        ON public.value_cases (tenant_id);
CREATE INDEX IF NOT EXISTS idx_value_cases_organization_id  ON public.value_cases (organization_id);
CREATE INDEX IF NOT EXISTS idx_value_cases_stage            ON public.value_cases (stage);
CREATE INDEX IF NOT EXISTS idx_value_cases_tenant_status    ON public.value_cases (tenant_id, status, updated_at DESC);

ALTER TABLE public.value_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY value_cases_tenant_select ON public.value_cases
  FOR SELECT USING (
    security.user_has_tenant_access(tenant_id)
    OR security.user_has_tenant_access(organization_id)
  );

CREATE POLICY value_cases_tenant_insert ON public.value_cases
  FOR INSERT WITH CHECK (
    security.user_has_tenant_access(tenant_id)
    OR security.user_has_tenant_access(organization_id)
  );

CREATE POLICY value_cases_tenant_update ON public.value_cases
  FOR UPDATE
  USING (
    security.user_has_tenant_access(tenant_id)
    OR security.user_has_tenant_access(organization_id)
  )
  WITH CHECK (
    security.user_has_tenant_access(tenant_id)
    OR security.user_has_tenant_access(organization_id)
  );

CREATE POLICY value_cases_tenant_delete ON public.value_cases
  FOR DELETE USING (
    security.user_has_tenant_access(tenant_id)
    OR security.user_has_tenant_access(organization_id)
  );

CREATE POLICY value_cases_service_role ON public.value_cases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.value_cases TO authenticated;
GRANT ALL ON public.value_cases TO service_role;

-- ============================================================================
-- 5. agent_memory
--    In-process memory store for agents. organization_id is the tenant key
--    for newer writes; tenant_id TEXT is the legacy key.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_memory (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid,
  tenant_id        text,
  organization_id  uuid,
  agent_id         uuid,
  memory_type      text        NOT NULL,
  content          text        NOT NULL,
  embedding        text,
  metadata         jsonb       DEFAULT '{}'::jsonb,
  importance_score double precision DEFAULT 0.5,
  provenance       jsonb       DEFAULT '{}'::jsonb,
  source           text,
  source_id        text,
  expires_at       timestamptz,
  created_at       timestamptz DEFAULT now(),
  accessed_at      timestamptz DEFAULT now(),
  CONSTRAINT agent_memory_type_check CHECK (
    memory_type = ANY (ARRAY['episodic','semantic','working','procedural'])
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_tenant_id       ON public.agent_memory (tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_organization_id ON public.agent_memory (organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_session_id      ON public.agent_memory (session_id);

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_memory_tenant_select ON public.agent_memory
  FOR SELECT USING (security.user_has_tenant_access(organization_id));

CREATE POLICY agent_memory_tenant_insert ON public.agent_memory
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id));

CREATE POLICY agent_memory_tenant_update ON public.agent_memory
  FOR UPDATE USING (security.user_has_tenant_access(organization_id))
  WITH CHECK (security.user_has_tenant_access(organization_id));

CREATE POLICY agent_memory_tenant_delete ON public.agent_memory
  FOR DELETE USING (security.user_has_tenant_access(organization_id));

CREATE POLICY agent_memory_service_role ON public.agent_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_memory TO authenticated;
GRANT ALL ON public.agent_memory TO service_role;

-- ============================================================================
-- 6. Billing tables
--    billing_customers, subscriptions, subscription_items, invoices,
--    usage_events, usage_aggregates, usage_quotas, usage_alerts
--    Referenced by active billing migrations (Sprint 10+).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_customers (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text        NOT NULL,
  organization_name     text        NOT NULL,
  stripe_customer_id    text        NOT NULL UNIQUE,
  stripe_customer_email text,
  status                text        DEFAULT 'active',
  default_payment_method text,
  payment_method_type   text,
  card_last4            text,
  card_brand            text,
  metadata              jsonb       DEFAULT '{}'::jsonb,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  CONSTRAINT billing_customers_status_check CHECK (
    status = ANY (ARRAY['active','suspended','cancelled'])
  )
);

CREATE INDEX IF NOT EXISTS idx_billing_customers_tenant_id ON public.billing_customers (tenant_id);

-- RLS applied by 20260301000000_rls_service_role_audit.sql

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_customer_id     uuid        REFERENCES public.billing_customers (id),
  tenant_id               text        NOT NULL,
  stripe_subscription_id  text        NOT NULL UNIQUE,
  stripe_customer_id      text        NOT NULL,
  plan_tier               text        NOT NULL,
  billing_period          text        DEFAULT 'monthly',
  status                  text        NOT NULL,
  current_period_start    timestamptz NOT NULL,
  current_period_end      timestamptz NOT NULL,
  trial_start             timestamptz,
  trial_end               timestamptz,
  canceled_at             timestamptz,
  ended_at                timestamptz,
  amount                  numeric(10,2),
  currency                text        DEFAULT 'usd',
  metadata                jsonb       DEFAULT '{}'::jsonb,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  CONSTRAINT subscriptions_billing_period_check CHECK (
    billing_period = ANY (ARRAY['monthly','yearly'])
  ),
  CONSTRAINT subscriptions_plan_tier_check CHECK (
    plan_tier = ANY (ARRAY['free','standard','enterprise'])
  ),
  CONSTRAINT subscriptions_status_check CHECK (
    status = ANY (ARRAY['active','past_due','canceled','unpaid','incomplete','trialing'])
  )
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON public.subscriptions (tenant_id);

-- RLS applied by 20260301000000_rls_service_role_audit.sql

CREATE TABLE IF NOT EXISTS public.subscription_items (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id          uuid        REFERENCES public.subscriptions (id) ON DELETE CASCADE,
  tenant_id                text        NOT NULL,
  stripe_subscription_item_id text,
  price_id                 text,
  product_id               text,
  quantity                 integer     DEFAULT 1,
  metadata                 jsonb       DEFAULT '{}'::jsonb,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_items_subscription ON public.subscription_items (subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_items_tenant       ON public.subscription_items (tenant_id);

CREATE TABLE IF NOT EXISTS public.invoices (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_customer_id  uuid        REFERENCES public.billing_customers (id),
  tenant_id            text        NOT NULL,
  subscription_id      uuid        REFERENCES public.subscriptions (id),
  stripe_invoice_id    text        NOT NULL UNIQUE,
  stripe_customer_id   text        NOT NULL,
  invoice_number       text,
  invoice_pdf_url      text,
  hosted_invoice_url   text,
  amount_due           numeric(10,2) NOT NULL,
  amount_paid          numeric(10,2) DEFAULT 0,
  amount_remaining     numeric(10,2),
  subtotal             numeric(10,2),
  tax                  numeric(10,2),
  total                numeric(10,2),
  currency             text        DEFAULT 'usd',
  status               text        NOT NULL,
  period_start         timestamptz,
  period_end           timestamptz,
  due_date             timestamptz,
  paid_at              timestamptz,
  line_items           jsonb       DEFAULT '[]'::jsonb,
  metadata             jsonb       DEFAULT '{}'::jsonb,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  CONSTRAINT invoices_status_check CHECK (
    status = ANY (ARRAY['draft','open','paid','void','uncollectible'])
  )
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON public.invoices (tenant_id);

-- RLS applied by 20260301000000_rls_service_role_audit.sql

CREATE TABLE IF NOT EXISTS public.usage_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL,
  meter_key        text        NOT NULL,
  quantity         numeric(15,4) NOT NULL DEFAULT 0,
  dimensions       jsonb       DEFAULT '{}'::jsonb,
  idempotency_key  text,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_idempotency
  ON public.usage_events (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_recorded
  ON public.usage_events (tenant_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.usage_aggregates (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL,
  meter_key    text        NOT NULL,
  period_start timestamptz NOT NULL,
  period_end   timestamptz NOT NULL,
  total        numeric(15,4) NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (tenant_id, meter_key, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_usage_aggregates_tenant_period
  ON public.usage_aggregates (tenant_id, period_start, period_end);

CREATE TABLE IF NOT EXISTS public.usage_quotas (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL,
  meter_key    text        NOT NULL,
  limit_value  numeric(15,4) NOT NULL,
  period       text        NOT NULL DEFAULT 'monthly',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (tenant_id, meter_key, period)
);

CREATE TABLE IF NOT EXISTS public.usage_alerts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL,
  meter_key    text        NOT NULL,
  threshold    numeric(5,2) NOT NULL,
  alert_type   text        NOT NULL DEFAULT 'warning',
  triggered_at timestamptz,
  resolved_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_alerts_tenant ON public.usage_alerts (tenant_id);

-- ============================================================================
-- 7. webhook_events
--    Stripe webhook ingestion. tenant_id UUID (not text) per the monolith.
--    RLS applied by 20260302000000_webhook_tenant_isolation.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid,
  stripe_event_id  text        NOT NULL UNIQUE,
  event_type       text        NOT NULL,
  payload          jsonb       NOT NULL,
  processed        boolean     DEFAULT false,
  processed_at     timestamptz,
  error_message    text,
  retry_count      integer     DEFAULT 0,
  next_retry_at    timestamptz,
  received_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_id ON public.webhook_events (tenant_id);

-- ============================================================================
-- 8. audit_logs
--    Immutable audit trail. Schema matches what AuditLogService inserts:
--    user_name, user_email, status, timestamp, integrity_hash, previous_hash,
--    details, archived.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid,
  organization_id uuid,
  user_id        uuid,
  user_name      text,
  user_email     text,
  action         text        NOT NULL,
  resource_type  text        NOT NULL,
  resource_id    text,
  details        jsonb,
  ip_address     text,
  user_agent     text,
  session_id     text,
  status         text        DEFAULT 'success',
  timestamp      timestamptz NOT NULL DEFAULT now(),
  integrity_hash text,
  previous_hash  text,
  archived       boolean     NOT NULL DEFAULT false,
  old_values     jsonb,
  new_values     jsonb,
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_status_check CHECK (status = ANY (ARRAY['success','failed']))
);

-- Tenant-scoped access path
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON public.audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON public.audit_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON public.audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archived
  ON public.audit_logs (archived) WHERE archived = false;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenants can read their own audit logs; no self-service write.
CREATE POLICY audit_logs_tenant_select ON public.audit_logs
  FOR SELECT USING (
    security.user_has_tenant_access(tenant_id)
    OR security.user_has_tenant_access(organization_id)
  );

-- Only service_role may insert (AuditLogService uses service_role client).
CREATE POLICY audit_logs_service_role ON public.audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL    ON public.audit_logs TO service_role;

-- Archive table: same schema, rows moved here by archiveOldLogs().
CREATE TABLE IF NOT EXISTS public.audit_logs_archive (
  LIKE public.audit_logs INCLUDING ALL
);

GRANT SELECT ON public.audit_logs_archive TO authenticated;
GRANT ALL    ON public.audit_logs_archive TO service_role;

-- ============================================================================
-- 9. security_audit_log
--    Security events (login attempts, blocked actions, DSR operations).
--    Referenced by dataSubjectRequests.ts and SecurityAuditService.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid,
  event_type       text        NOT NULL,
  actor            text,
  user_id          uuid,
  action           text,
  table_name       text,
  attempted_action text,
  details          jsonb,
  metadata         jsonb,
  blocked_at       timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_tenant
  ON public.security_audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_type
  ON public.security_audit_log (event_type, created_at DESC);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_audit_log_service_role ON public.security_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users may read their own tenant's security events.
CREATE POLICY security_audit_log_tenant_select ON public.security_audit_log
  FOR SELECT USING (security.user_has_tenant_access(tenant_id));

GRANT SELECT ON public.security_audit_log TO authenticated;
GRANT ALL    ON public.security_audit_log TO service_role;
