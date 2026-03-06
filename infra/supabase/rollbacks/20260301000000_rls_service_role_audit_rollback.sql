-- Rollback: 20260301000000_rls_service_role_audit
-- Disables RLS on billing tables. Apply only during emergency rollback;
-- re-enable RLS immediately after the forward-fix is deployed.
ALTER TABLE public.billing_customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events DISABLE ROW LEVEL SECURITY;
