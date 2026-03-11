-- ============================================================================
-- Add slug, tenant_id, and is_system_role to roles
--
-- The roles table previously had no tenant_id column — tenant scoping was
-- encoded into the name field as "custom:{tenantId}:{roleName}". This made
-- querying and uniqueness enforcement fragile.
--
-- Changes:
--   1. Add tenant_id (nullable — NULL for system/built-in roles)
--   2. Add slug — URL-safe identifier, unique per (tenant_id, slug)
--   3. Add is_system_role — boolean flag replacing the "custom:" prefix heuristic
--   4. Backfill all three columns from existing name values
--   5. Add unique index on (tenant_id, slug) for custom roles
-- ============================================================================

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. Add columns
-- ============================================================================

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS is_system_role boolean NOT NULL DEFAULT false;

-- ============================================================================
-- 2. Backfill is_system_role
--    Custom roles have names starting with "custom:" — all others are system.
-- ============================================================================

UPDATE public.roles
SET is_system_role = NOT (name LIKE 'custom:%')
WHERE is_system_role = false;

-- ============================================================================
-- 3. Backfill tenant_id from encoded name for custom roles
--    Encoded format: "custom:{tenantId}:{roleName}"
--    Extract the UUID segment between the first and second colon after "custom:".
-- ============================================================================

UPDATE public.roles
SET tenant_id = (
  -- Strip "custom:" prefix, then take the first colon-delimited segment.
  split_part(substring(name FROM 8), ':', 1)::uuid
)
WHERE name LIKE 'custom:%'
  AND tenant_id IS NULL;

-- ============================================================================
-- 4. Backfill slug
--    Custom roles: URL-safe version of the decoded role name (after tenantId segment).
--    System roles: URL-safe version of the raw name.
-- ============================================================================

UPDATE public.roles
SET slug = lower(regexp_replace(
  CASE
    WHEN name LIKE 'custom:%' THEN
      -- Strip "custom:{tenantId}:" prefix to get the bare role name.
      substring(name FROM length('custom:' || split_part(substring(name FROM 8), ':', 1) || ':') + 1)
    ELSE
      name
  END,
  '[^a-z0-9]+', '-', 'g'
))
WHERE slug IS NULL;

-- ============================================================================
-- 5. Unique index: one slug per tenant (NULL tenant_id = system role, globally unique)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_tenant_slug
  ON public.roles (tenant_id, slug)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_system_slug
  ON public.roles (slug)
  WHERE tenant_id IS NULL;

-- ============================================================================
-- 6. Index on tenant_id for fast per-tenant role listing
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_roles_tenant_id
  ON public.roles (tenant_id)
  WHERE tenant_id IS NOT NULL;
