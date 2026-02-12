-- Enforce RLS on all tables and restrict NULL tenant/org access
-- Filename: 20260208_rls_enforcement.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;

-- For each table with tenant_id or organization_id, deny access if NULL
-- (Add/modify as needed for your schema)

-- Example for tenant_id
do $$
declare
  rec record;
begin
  for rec in select tablename from pg_tables where schemaname = 'public' and (
    exists (select 1 from information_schema.columns where table_name = tablename and column_name = 'tenant_id')
    or exists (select 1 from information_schema.columns where table_name = tablename and column_name = 'organization_id')
  )
  loop
    if exists (select 1 from information_schema.columns where table_name = rec.tablename and column_name = 'tenant_id') then
      EXECUTE format('CREATE POLICY deny_null_tenant_id ON public.%I AS RESTRICTIVE FOR ALL USING (tenant_id IS NOT NULL);', rec.tablename);
    end if;
    if exists (select 1 from information_schema.columns where table_name = rec.tablename and column_name = 'organization_id') then
      EXECUTE format('CREATE POLICY deny_null_organization_id ON public.%I AS RESTRICTIVE FOR ALL USING (organization_id IS NOT NULL);', rec.tablename);
    end if;
  end loop;
end $$;

-- Document any exceptions with a comment above the policy.
