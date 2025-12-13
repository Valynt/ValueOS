-- Migration: Defensive fixes for tenant columns, FKs and triggers
-- Run with: supabase db push

-- Ensure organization_id and FK exist on tenant-scoped tables and update triggers/policies safely
DO $$
DECLARE
  t TEXT;
  fk_exists BOOLEAN;
BEGIN
  FOREACH t IN ARRAY['users','models','agents','agent_runs','agent_memory','api_keys','kpis','cases','workflows','workflow_states','shared_artifacts','audit_logs'] LOOP
    -- Ensure column exists
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ADD COLUMN IF NOT EXISTS organization_id uuid', t);

    -- Add FK if missing
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' AND tc.table_name = t AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'organization_id')
    INTO fk_exists;
    IF NOT fk_exists THEN
      BEGIN
        EXECUTE format('ALTER TABLE IF EXISTS public.%I ADD CONSTRAINT %I_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE', t, t);
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Skipping FK creation for % due to: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$;

-- Ensure functions exist in public schema (SQL form for plan stability)
CREATE OR REPLACE FUNCTION public.get_current_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'org_id'), '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid
$$;

REVOKE ALL ON FUNCTION public.get_current_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO authenticated;

-- Robust audit trigger: avoid failures when table lacks organization_id
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  org_id uuid;
  user_id uuid;
  has_org boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'organization_id'
  ) INTO has_org;

  IF has_org THEN
    IF TG_OP = 'DELETE' THEN
      org_id := OLD.organization_id;
    ELSE
      org_id := NEW.organization_id;
    END IF;
  ELSE
    org_id := (SELECT public.get_current_org_id());
  END IF;

  user_id := (SELECT public.get_current_user_id());

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
      VALUES (org_id, user_id, 'delete', TG_TABLE_NAME, OLD.id, jsonb_build_object('before', row_to_json(OLD)));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
      VALUES (org_id, user_id, 'update', TG_TABLE_NAME, NEW.id, jsonb_build_object('before', row_to_json(OLD), 'after', row_to_json(NEW)));
  ELSE
    INSERT INTO public.audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
      VALUES (org_id, user_id, 'create', TG_TABLE_NAME, NEW.id, jsonb_build_object('after', row_to_json(NEW)));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit trigger only if table exists and trigger does not already exist
DO $$
DECLARE
  t name;
  trg text;
BEGIN
  FOREACH t IN ARRAY['users','agents','models','cases','workflows','workflow_states','shared_artifacts'] LOOP
    trg := format('audit_%s', t);
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = t) AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = trg) THEN
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', trg, t);
    END IF;
  END LOOP;
END;
$$;

-- Ensure update_timestamp trigger exists on additional tables if they have updated_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cases' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cases_timestamp') THEN
    CREATE TRIGGER update_cases_timestamp BEFORE UPDATE ON cases FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_workflows_timestamp') THEN
    CREATE TRIGGER update_workflows_timestamp BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflow_states' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_workflow_states_timestamp') THEN
    CREATE TRIGGER update_workflow_states_timestamp BEFORE UPDATE ON workflow_states FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shared_artifacts' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shared_artifacts_timestamp') THEN
    CREATE TRIGGER update_shared_artifacts_timestamp BEFORE UPDATE ON shared_artifacts FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_runs' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_runs_timestamp') THEN
    CREATE TRIGGER update_agent_runs_timestamp BEFORE UPDATE ON agent_runs FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_memory' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_memory_timestamp') THEN
    CREATE TRIGGER update_agent_memory_timestamp BEFORE UPDATE ON agent_memory FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
  END IF;
END;
$$;
