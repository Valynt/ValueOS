-- Rollback: 20260213000010_canonical_identity_baseline.sql
-- Drops all tables, schemas, and functions created by the canonical identity
-- baseline migration.
--
-- WARNING: This migration is the foundation of the active migration chain.
-- Applying this rollback on a database with data will cause irreversible data
-- loss. Only use this in a fresh environment to undo a failed initial apply.

SET search_path = public, pg_temp;

-- Audit / compliance
DROP TABLE IF EXISTS public.security_audit_log CASCADE;
DROP TABLE IF EXISTS public.audit_logs_archive CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- Billing
DROP TABLE IF EXISTS public.webhook_events CASCADE;
DROP TABLE IF EXISTS public.usage_alerts CASCADE;
DROP TABLE IF EXISTS public.usage_quotas CASCADE;
DROP TABLE IF EXISTS public.usage_aggregates CASCADE;
DROP TABLE IF EXISTS public.usage_events CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.subscription_items CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.billing_customers CASCADE;

-- Core product
DROP TABLE IF EXISTS public.agent_memory CASCADE;
DROP TABLE IF EXISTS public.value_cases CASCADE;

-- Identity / auth
DROP TABLE IF EXISTS public.memberships CASCADE;
DROP TABLE IF EXISTS public.user_tenants CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;

-- Security schema and function
DROP FUNCTION IF EXISTS security.user_has_tenant_access(text) CASCADE;
DROP SCHEMA IF EXISTS app CASCADE;
DROP SCHEMA IF EXISTS security CASCADE;
