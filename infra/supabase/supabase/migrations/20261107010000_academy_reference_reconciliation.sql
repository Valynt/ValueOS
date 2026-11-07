-- Academy global-reference schema bridge for active 10-pillar catalog.
-- rls-classification: public_read (authenticated global reference only).
-- Create the missing active baseline tables BEFORE 20260319000000.
-- DO NOT coerce archived seven-value academy_pillar enum or rewrite rows.
-- A preexisting non-integer academy_modules.pillar is an EXPLICIT STOP:
-- deployed history, data mapping and runtime clients need an approved plan.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = pg_catalog, public;

CREATE TABLE IF NOT EXISTS public.academy_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar integer NOT NULL CHECK (pillar BETWEEN 1 AND 10),
  title text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  estimated_minutes integer NOT NULL DEFAULT 30
    CHECK (estimated_minutes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Child curriculum rows are global reference data, never tenant-owned.
-- Narrow, additive schema needed by Academy's modules+lessons API.
CREATE TABLE IF NOT EXISTS public.academy_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.academy_modules(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  content_type text NOT NULL DEFAULT 'article',
  display_order integer NOT NULL DEFAULT 0,
  estimated_minutes integer NOT NULL DEFAULT 10 CHECK (estimated_minutes >= 0),
  sdui_components jsonb NOT NULL DEFAULT '[]'::jsonb,
  prerequisites uuid[] NOT NULL DEFAULT '{}'::uuid[],
  tracks text[] NOT NULL DEFAULT '{}'::text[],
  lab_config jsonb,
  quiz_config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

LOCK TABLE public.academy_modules, public.academy_lessons
  IN SHARE ROW EXCLUSIVE MODE;

-- Fail closed if an earlier/archived production shape already exists.
-- CREATE TABLE IF NOT EXISTS is NOT a compatibility check. The archived enum
-- shape cannot support the following integer pillar FK. No ALTER TYPE here.
DO $preflight$
DECLARE
  rec record;
  observed regtype;
  found_pk boolean;
BEGIN
  FOR rec IN SELECT * FROM (VALUES
    ('academy_modules','id','uuid'::regtype),
    ('academy_modules','pillar','integer'::regtype),
    ('academy_modules','title','text'::regtype),
    ('academy_modules','display_order','integer'::regtype),
    ('academy_lessons','id','uuid'::regtype),
    ('academy_lessons','module_id','uuid'::regtype),
    ('academy_lessons','title','text'::regtype)
  ) AS x(tab,col,expected) LOOP
    SELECT atttypid::regtype INTO observed FROM pg_attribute
    WHERE attrelid=format('public.%I',rec.tab)::regclass
      AND attname=rec.col AND NOT attisdropped;
    IF observed IS DISTINCT FROM rec.expected THEN
      RAISE EXCEPTION
        'Academy %.% incompatible type: observed %, required %. No implicit enum/integer migration',
        rec.tab, rec.col, observed, rec.expected USING ERRCODE='42804';
    END IF;
  END LOOP;

  -- Every existing table must have a primary key for safe module/lesson
  -- relationships. Existence alone is insufficient.
  FOR rec IN SELECT * FROM (VALUES('academy_modules'),('academy_lessons')) AS x(tab) LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid=format('public.%I',rec.tab)::regclass AND contype='p'
    ) INTO found_pk;
    IF NOT found_pk THEN
      RAISE EXCEPTION 'Academy %.id primary key missing; manual reconciliation required',
        rec.tab USING ERRCODE='23514';
    END IF;
  END LOOP;

  -- Do not allow present modules with noncatalog pillar IDs to bypass
  -- the future reference relation (1..10).
  IF EXISTS (SELECT 1 FROM public.academy_modules
             WHERE pillar IS NULL OR pillar NOT BETWEEN 1 AND 10) THEN
    RAISE EXCEPTION 'Academy pillar values outside 1..10; no automatic repair'
      USING ERRCODE='23514';
  END IF;

  -- A pre-existing child FK must point to the correct parent table.
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.academy_lessons'::regclass
      AND c.contype='f' AND c.confrelid<>'public.academy_modules'::regclass
  ) THEN
    RAISE EXCEPTION 'Academy lesson FK points to incompatible parent'
      USING ERRCODE='23514';
  END IF;
END $preflight$;

-- Missing FK in an existing compatible table: enforce parent integrity,
-- refusing orphan rows rather than silently deleting or reassigning them.
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE
      conrelid='public.academy_lessons'::regclass
      AND confrelid='public.academy_modules'::regclass AND contype='f'
  ) THEN
    ALTER TABLE public.academy_lessons
      ADD CONSTRAINT academy_lessons_module_id_fkey
      FOREIGN KEY (module_id) REFERENCES public.academy_modules(id)
      ON DELETE RESTRICT;
  END IF;
END $fk$;

CREATE INDEX IF NOT EXISTS idx_academy_modules_pillar_display
  ON public.academy_modules (pillar, display_order);
CREATE INDEX IF NOT EXISTS idx_academy_lessons_module_display
  ON public.academy_lessons (module_id, display_order);

-- Reference curriculum is readable by authenticated users; no
-- authenticated insert/update/delete permission or permissive write policy.
ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academy_modules, public.academy_lessons
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.academy_modules, public.academy_lessons TO authenticated;
GRANT ALL ON public.academy_modules, public.academy_lessons TO service_role;

DO $rls$
DECLARE
  target text;
  policy_name text;
  valid boolean;
BEGIN
  FOREACH target IN ARRAY ARRAY['academy_modules','academy_lessons'] LOOP
    policy_name := target || '_reference_authenticated_read';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy
      WHERE polrelid=format('public.%I',target)::regclass
        AND polname=policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
        policy_name,target);
    ELSE
      SELECT polcmd='r' AND polpermissive INTO valid
      FROM pg_policy WHERE polrelid=format('public.%I',target)::regclass
        AND polname=policy_name;
      IF NOT valid THEN
        RAISE EXCEPTION 'Academy read policy conflict: %',policy_name
          USING ERRCODE='23514';
      END IF;
    END IF;
    -- Harden existing shapes with an independent restrictive deny
    -- rather than relying on old permissive write policies.
    FOREACH policy_name IN ARRAY ARRAY['insert','update','delete'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polrelid=format('public.%I',target)::regclass
          AND polname=target || '_reference_' || policy_name || '_deny'
      ) THEN
        IF policy_name='insert' THEN
          EXECUTE format(
            'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false)',
            target || '_reference_' || policy_name || '_deny',target);
        ELSIF policy_name='update' THEN
          EXECUTE format(
            'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false)',
            target || '_reference_' || policy_name || '_deny',target);
        ELSE
          EXECUTE format(
            'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (false)',
            target || '_reference_' || policy_name || '_deny',target);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $rls$;
COMMIT;
