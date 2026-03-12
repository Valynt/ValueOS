-- Rollback: 20260329000000_canonical_identity_baseline
-- WARNING: Only apply this if you are rolling back a fresh environment.
-- On a database that had these tables from the archived monolith, dropping
-- them will destroy data. Verify before running.

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.security_audit_log CASCADE;
DROP TABLE IF EXISTS public.audit_logs_archive CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.webhook_events CASCADE;
DROP TABLE IF EXISTS public.usage_alerts CASCADE;
DROP TABLE IF EXISTS public.usage_quotas CASCADE;
DROP TABLE IF EXISTS public.usage_aggregates CASCADE;
DROP TABLE IF EXISTS public.usage_events CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.subscription_items CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.billing_customers CASCADE;
DROP TABLE IF EXISTS public.agent_memory CASCADE;
DROP TABLE IF EXISTS public.value_cases CASCADE;
DROP TABLE IF EXISTS public.memberships CASCADE;
DROP TABLE IF EXISTS public.user_tenants CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;

DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS app.is_active_member(text, uuid);
DROP FUNCTION IF EXISTS security.user_has_tenant_access(TEXT);
DROP FUNCTION IF EXISTS security.user_has_tenant_access(UUID);
DROP FUNCTION IF EXISTS security.current_tenant_id_uuid();
DROP FUNCTION IF EXISTS security.current_tenant_id();

DROP SCHEMA IF EXISTS app;
DROP SCHEMA IF EXISTS security;
