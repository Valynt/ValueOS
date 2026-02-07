-- ==========================================================================
-- Replace legacy tenant isolation policies with security.current_tenant_id()
-- ============================================================================

-- Secret audit logs tenant isolation
DROP POLICY IF EXISTS secret_audit_logs_tenant_isolation ON public.secret_audit_logs;
CREATE POLICY secret_audit_logs_tenant_isolation ON public.secret_audit_logs
AS RESTRICTIVE
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
);

DROP POLICY IF EXISTS secret_audit_logs_tenant_isolation ON public.secret_audit_logs_legacy;
CREATE POLICY secret_audit_logs_tenant_isolation ON public.secret_audit_logs_legacy
AS RESTRICTIVE
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
);

-- LLM gating and usage tenant isolation
DROP POLICY IF EXISTS llm_gating_policies_tenant_isolation ON public.llm_gating_policies;
CREATE POLICY llm_gating_policies_tenant_isolation ON public.llm_gating_policies
AS RESTRICTIVE
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
);

DROP POLICY IF EXISTS llm_usage_tenant_isolation ON public.llm_usage;
CREATE POLICY llm_usage_tenant_isolation ON public.llm_usage
AS RESTRICTIVE
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
);

-- LLM usage/budget policies (legacy "Tenants can view/insert/update" policies)
DROP POLICY IF EXISTS "Tenants can view own usage" ON public.llm_usage;
CREATE POLICY "Tenants can view own usage" ON public.llm_usage
AS RESTRICTIVE
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
);

DROP POLICY IF EXISTS "Tenants can insert own usage" ON public.llm_usage;
CREATE POLICY "Tenants can insert own usage" ON public.llm_usage
AS RESTRICTIVE
FOR INSERT
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
);

DROP POLICY IF EXISTS "Tenants can view own budget" ON public.llm_gating_policies;
CREATE POLICY "Tenants can view own budget" ON public.llm_gating_policies
AS RESTRICTIVE
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
);

DROP POLICY IF EXISTS "Tenants can update own budget" ON public.llm_gating_policies;
CREATE POLICY "Tenants can update own budget" ON public.llm_gating_policies
AS RESTRICTIVE
FOR UPDATE
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
);

DROP POLICY IF EXISTS "Strict tenant isolation - usage logs" ON public.llm_usage;
CREATE POLICY "Strict tenant isolation - usage logs" ON public.llm_usage
AS RESTRICTIVE
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
);

DROP POLICY IF EXISTS "Strict tenant isolation - budgets" ON public.llm_gating_policies;
CREATE POLICY "Strict tenant isolation - budgets" ON public.llm_gating_policies
AS RESTRICTIVE
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    tenant_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(tenant_id)
  )
);

-- Agent accuracy metrics org isolation
DROP POLICY IF EXISTS "Users can view org metrics" ON public.agent_accuracy_metrics;
CREATE POLICY "Users can view org metrics" ON public.agent_accuracy_metrics
AS RESTRICTIVE
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR organization_id IS NULL
  OR (
    organization_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(organization_id)
  )
);

-- Organization configurations tenant isolation
DROP POLICY IF EXISTS org_configs_tenant_isolation ON public.organization_configurations;
CREATE POLICY org_configs_tenant_isolation ON public.organization_configurations
AS RESTRICTIVE
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    organization_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(organization_id)
  )
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    organization_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(organization_id)
  )
);

-- Customer access tokens tenant isolation
DROP POLICY IF EXISTS customer_tokens_tenant_isolation ON public.customer_access_tokens;
CREATE POLICY customer_tokens_tenant_isolation ON public.customer_access_tokens
AS RESTRICTIVE
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.value_cases
    WHERE value_cases.id = customer_access_tokens.value_case_id
      AND value_cases.tenant_id::text = security.current_tenant_id()
      AND security.user_has_tenant_access(value_cases.tenant_id)
  )
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.value_cases
    WHERE value_cases.id = customer_access_tokens.value_case_id
      AND value_cases.tenant_id::text = security.current_tenant_id()
      AND security.user_has_tenant_access(value_cases.tenant_id)
  )
);

-- Audit logs tenant isolation for linked usage logs
DROP POLICY IF EXISTS "Tenants can view linked audit logs" ON public.audit_logs;
CREATE POLICY "Tenants can view linked audit logs" ON public.audit_logs
AS RESTRICTIVE
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (
    organization_id::text = security.current_tenant_id()
    AND security.user_has_tenant_access(organization_id)
    AND EXISTS (
      SELECT 1
      FROM public.llm_usage lul
      WHERE lul.audit_log_id = audit_logs.id
        AND lul.tenant_id::text = security.current_tenant_id()
        AND security.user_has_tenant_access(lul.tenant_id)
    )
  )
);
