-- ============================================================================
-- 20260213000003_research_onboarding_tenant_uuid_alignment.sql
-- Align research onboarding tables to canonical tenant UUID, object naming,
-- indexes/triggers, and restrictive RLS policy pattern.
-- ============================================================================

-- 1) Safe tenant_id conversion: TEXT -> UUID with backfill mapping via tenants.id::text / tenants.slug
DO $migration$
DECLARE
  col_type text;
  unmapped_count bigint;
BEGIN
  -- company_research_jobs
  SELECT data_type
    INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'company_research_jobs'
    AND column_name = 'tenant_id';

  IF col_type = 'text' THEN
    ALTER TABLE public.company_research_jobs
      ADD COLUMN IF NOT EXISTS tenant_id_uuid uuid;

    UPDATE public.company_research_jobs rj
       SET tenant_id_uuid = t.id
      FROM public.tenants t
     WHERE rj.tenant_id_uuid IS NULL
       AND (t.id::text = rj.tenant_id OR t.slug = rj.tenant_id);

    SELECT count(*) INTO unmapped_count
    FROM public.company_research_jobs
    WHERE tenant_id_uuid IS NULL;

    IF unmapped_count > 0 THEN
      RAISE EXCEPTION 'company_research_jobs has % unmapped tenant_id values; migration aborted', unmapped_count;
    END IF;

    ALTER TABLE public.company_research_jobs
      ALTER COLUMN tenant_id_uuid SET NOT NULL;

    ALTER TABLE public.company_research_jobs
      RENAME COLUMN tenant_id TO tenant_id_legacy;

    ALTER TABLE public.company_research_jobs
      RENAME COLUMN tenant_id_uuid TO tenant_id;
  END IF;

  -- company_research_suggestions
  SELECT data_type
    INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'company_research_suggestions'
    AND column_name = 'tenant_id';

  IF col_type = 'text' THEN
    ALTER TABLE public.company_research_suggestions
      ADD COLUMN IF NOT EXISTS tenant_id_uuid uuid;

    UPDATE public.company_research_suggestions rs
       SET tenant_id_uuid = t.id
      FROM public.tenants t
     WHERE rs.tenant_id_uuid IS NULL
       AND (t.id::text = rs.tenant_id OR t.slug = rs.tenant_id);

    SELECT count(*) INTO unmapped_count
    FROM public.company_research_suggestions
    WHERE tenant_id_uuid IS NULL;

    IF unmapped_count > 0 THEN
      RAISE EXCEPTION 'company_research_suggestions has % unmapped tenant_id values; migration aborted', unmapped_count;
    END IF;

    ALTER TABLE public.company_research_suggestions
      ALTER COLUMN tenant_id_uuid SET NOT NULL;

    ALTER TABLE public.company_research_suggestions
      RENAME COLUMN tenant_id TO tenant_id_legacy;

    ALTER TABLE public.company_research_suggestions
      RENAME COLUMN tenant_id_uuid TO tenant_id;
  END IF;
END
$migration$;

-- 2) Canonical constraints
DO $fk$
DECLARE
  constraint_name text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_research_jobs_pkey'
      AND conrelid = 'public.company_research_jobs'::regclass
  ) THEN
    ALTER TABLE public.company_research_jobs
      RENAME CONSTRAINT company_research_jobs_pkey TO pk_company_research_jobs;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_research_suggestions_pkey'
      AND conrelid = 'public.company_research_suggestions'::regclass
  ) THEN
    ALTER TABLE public.company_research_suggestions
      RENAME CONSTRAINT company_research_suggestions_pkey TO pk_company_research_suggestions;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_research_suggestions_job_id_fkey'
      AND conrelid = 'public.company_research_suggestions'::regclass
  ) THEN
    ALTER TABLE public.company_research_suggestions
      RENAME CONSTRAINT company_research_suggestions_job_id_fkey TO fk_company_research_suggestions_job_id_company_research_jobs;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_research_suggestions_context_id_fkey'
      AND conrelid = 'public.company_research_suggestions'::regclass
  ) THEN
    ALTER TABLE public.company_research_suggestions
      RENAME CONSTRAINT company_research_suggestions_context_id_fkey TO fk_company_research_suggestions_context_id_company_contexts;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_research_jobs_context_id_fkey'
      AND conrelid = 'public.company_research_jobs'::regclass
  ) THEN
    ALTER TABLE public.company_research_jobs
      RENAME CONSTRAINT company_research_jobs_context_id_fkey TO fk_company_research_jobs_context_id_company_contexts;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_company_research_jobs_context_id_company_contexts'
      AND conrelid = 'public.company_research_jobs'::regclass
  ) THEN
    ALTER TABLE public.company_research_jobs
      ADD CONSTRAINT fk_company_research_jobs_context_id_company_contexts
      FOREIGN KEY (context_id) REFERENCES public.company_contexts(id) ON DELETE CASCADE;
  END IF;

  -- Drop any existing tenant FK variants so the canonical name is declared once
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.company_research_jobs'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.company_research_jobs'::regclass AND attname = 'tenant_id' AND NOT attisdropped)
      ]
  LOOP
    EXECUTE format('ALTER TABLE public.company_research_jobs DROP CONSTRAINT %I;', constraint_name);
  END LOOP;

  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.company_research_suggestions'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.company_research_suggestions'::regclass AND attname = 'tenant_id' AND NOT attisdropped)
      ]
  LOOP
    EXECUTE format('ALTER TABLE public.company_research_suggestions DROP CONSTRAINT %I;', constraint_name);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_company_research_jobs_tenant_id_tenants'
      AND conrelid = 'public.company_research_jobs'::regclass
  ) THEN
    ALTER TABLE public.company_research_jobs
      ADD CONSTRAINT fk_company_research_jobs_tenant_id_tenants
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_company_research_suggestions_tenant_id_tenants'
      AND conrelid = 'public.company_research_suggestions'::regclass
  ) THEN
    ALTER TABLE public.company_research_suggestions
      ADD CONSTRAINT fk_company_research_suggestions_tenant_id_tenants
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END
$fk$;

-- 3) Consolidated canonical indexes
DROP INDEX IF EXISTS public.idx_research_jobs_tenant;
DROP INDEX IF EXISTS public.idx_research_jobs_context;
DROP INDEX IF EXISTS public.idx_research_jobs_status;
DROP INDEX IF EXISTS public.idx_research_suggestions_tenant;
DROP INDEX IF EXISTS public.idx_research_suggestions_job;
DROP INDEX IF EXISTS public.idx_research_suggestions_context;
DROP INDEX IF EXISTS public.idx_research_suggestions_entity_type;
DROP INDEX IF EXISTS public.idx_research_suggestions_status;
DROP INDEX IF EXISTS public.idx_research_suggestions_entity_hash;

CREATE INDEX IF NOT EXISTS idx_company_research_jobs_tenant_id
  ON public.company_research_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_research_jobs_context_id
  ON public.company_research_jobs(context_id);
CREATE INDEX IF NOT EXISTS idx_company_research_jobs_status
  ON public.company_research_jobs(status);

CREATE INDEX IF NOT EXISTS idx_company_research_suggestions_tenant_id
  ON public.company_research_suggestions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_research_suggestions_job_id
  ON public.company_research_suggestions(job_id);
CREATE INDEX IF NOT EXISTS idx_company_research_suggestions_context_id
  ON public.company_research_suggestions(context_id);
CREATE INDEX IF NOT EXISTS idx_company_research_suggestions_entity_type
  ON public.company_research_suggestions(entity_type);
CREATE INDEX IF NOT EXISTS idx_company_research_suggestions_status
  ON public.company_research_suggestions(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_research_suggestions_entity_hash
  ON public.company_research_suggestions(entity_hash)
  WHERE entity_hash IS NOT NULL;

-- 4) Consolidated canonical trigger declaration
DROP TRIGGER IF EXISTS trg_research_jobs_updated_at ON public.company_research_jobs;
DROP TRIGGER IF EXISTS trg_company_research_jobs_set_updated_at ON public.company_research_jobs;

CREATE TRIGGER trg_company_research_jobs_set_updated_at
  BEFORE UPDATE ON public.company_research_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Canonical restrictive RLS policy pattern
ALTER TABLE public.company_research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_research_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_research_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_research_suggestions FORCE ROW LEVEL SECURITY;

DO $rls$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['company_research_jobs', 'company_research_suggestions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS research_jobs_tenant_select ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS research_jobs_tenant_insert ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS research_jobs_tenant_update ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS research_jobs_service_all ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS research_suggestions_tenant_select ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS research_suggestions_tenant_insert ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS research_suggestions_tenant_update ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS research_suggestions_service_all ON public.%I;', tbl);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON public.%I;', tbl);

    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON public.%I AS RESTRICTIVE FOR SELECT USING (security.user_has_tenant_access(tenant_id));',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id));',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON public.%I AS RESTRICTIVE FOR UPDATE USING (security.user_has_tenant_access(tenant_id)) WITH CHECK (security.user_has_tenant_access(tenant_id));',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON public.%I AS RESTRICTIVE FOR DELETE USING (security.user_has_tenant_access(tenant_id));',
      tbl
    );
  END LOOP;
END
$rls$;
