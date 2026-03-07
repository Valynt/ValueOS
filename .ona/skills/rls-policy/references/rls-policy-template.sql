-- RLS policy template for a tenant-scoped table.
-- Replace <table_name> throughout. Run after the table is created.

-- Step 1: Enable RLS
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- Step 2: Four standard policies
-- Naming convention: <table_name>_tenant_<operation>

CREATE POLICY <table_name>_tenant_select
  ON public.<table_name> FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY <table_name>_tenant_insert
  ON public.<table_name> FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY <table_name>_tenant_update
  ON public.<table_name> FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY <table_name>_tenant_delete
  ON public.<table_name> FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- Optional: service_role bypass for cron jobs / tenant provisioning only.
-- Do NOT add this unless the table is accessed by a background job that
-- runs outside the user session context.
--
-- CREATE POLICY <table_name>_service_role_bypass
--   ON public.<table_name>
--   USING (auth.role() = 'service_role');
