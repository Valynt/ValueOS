-- Add slug, tenant_id, and is_system_role to roles.
-- Guarded: skips silently if public.roles does not exist.

SET search_path = public, pg_temp;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'roles'
  ) THEN
    RAISE NOTICE 'public.roles does not exist — skipping migration.';
    RETURN;
  END IF;

  ALTER TABLE public.roles
    ADD COLUMN IF NOT EXISTS tenant_id uuid,
    ADD COLUMN IF NOT EXISTS slug text,
    ADD COLUMN IF NOT EXISTS is_system_role boolean NOT NULL DEFAULT false;

  UPDATE public.roles
  SET is_system_role = NOT (name LIKE 'custom:%')
  WHERE is_system_role = false;

  UPDATE public.roles
  SET tenant_id = split_part(substring(name FROM 8), ':', 1)::uuid
  WHERE name LIKE 'custom:%' AND tenant_id IS NULL;

  UPDATE public.roles
  SET slug = lower(regexp_replace(
    CASE
      WHEN name LIKE 'custom:%' THEN
        substring(name FROM length('custom:' || split_part(substring(name FROM 8), ':', 1) || ':') + 1)
      ELSE name
    END,
    '[^a-z0-9]+', '-', 'g'
  ))
  WHERE slug IS NULL;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_roles_tenant_slug') THEN
    CREATE UNIQUE INDEX idx_roles_tenant_slug ON public.roles (tenant_id, slug) WHERE tenant_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_roles_system_slug') THEN
    CREATE UNIQUE INDEX idx_roles_system_slug ON public.roles (slug) WHERE tenant_id IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_roles_tenant_id') THEN
    CREATE INDEX idx_roles_tenant_id ON public.roles (tenant_id) WHERE tenant_id IS NOT NULL;
  END IF;
END $$;
