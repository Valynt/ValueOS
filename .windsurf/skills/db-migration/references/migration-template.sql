-- <Short description of what this migration does and why.>
-- Replace all <placeholders> before running.

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. <table_name>
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.<table_name> (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL,                          -- tenant isolation — required
  -- <add domain columns here>
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_<table_name>_org_id
  ON public.<table_name> (organization_id);

-- Add additional indexes for frequent filter columns:
-- CREATE INDEX IF NOT EXISTS idx_<table_name>_<col>
--   ON public.<table_name> (<col>);

-- RLS
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

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

-- ============================================================================
-- 2. ADD COLUMN example (use instead of CREATE TABLE when extending a table)
-- ============================================================================

-- ALTER TABLE public.<existing_table>
--   ADD COLUMN IF NOT EXISTS <column_name> <type> <constraints>;

-- CREATE INDEX IF NOT EXISTS idx_<existing_table>_<column_name>
--   ON public.<existing_table> (<column_name>);
