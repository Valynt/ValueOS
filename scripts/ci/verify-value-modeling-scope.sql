\set ON_ERROR_STOP on
BEGIN;
DO $checks$
BEGIN
  IF (SELECT count(*) FROM public.assumptions WHERE organization_id IS NOT NULL) <> 2
    OR (SELECT count(*) FROM public.scenarios WHERE organization_id IS NOT NULL) <> 2
    OR (SELECT sum(value) FROM public.assumptions) <> 126 THEN
    RAISE EXCEPTION 'Backfill did not preserve populated fixture rows';
  END IF;
  BEGIN
    UPDATE public.value_cases SET organization_id = '20000000-0000-4000-8000-000000000222'
      WHERE id = '40000000-0000-4000-8000-000000000111';
    RAISE EXCEPTION 'Case organization reassignment was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.scenarios(case_id,organization_id,scenario_type) VALUES
      ('40000000-0000-4000-8000-000000000333','30000000-0000-4000-8000-000000000333','base');
    RAISE EXCEPTION 'Non-UUID legacy tenant was silently converted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $checks$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000111';
DO $rls$
DECLARE changed integer;
BEGIN
  IF (SELECT count(*) FROM public.assumptions) <> 1
    OR (SELECT count(*) FROM public.scenarios) <> 1 THEN
    RAISE EXCEPTION 'Tenant/organization UUID collision leaked rows or hid own rows';
  END IF;
  INSERT INTO public.assumptions(case_id,organization_id,name,value,unit,source_type,confidence_score)
    VALUES ('40000000-0000-4000-8000-000000000111','10000000-0000-4000-8000-000000000111','New caller',1,'USD','inferred',0.8);
  INSERT INTO public.scenarios(case_id,tenant_id,scenario_type)
    VALUES ('40000000-0000-4000-8000-000000000111','aaaaaaaa-0000-4000-8000-000000000001','upside');
  UPDATE public.assumptions SET value = 43 WHERE id = '50000000-0000-4000-8000-000000000111';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Own-row update failed'; END IF;
  UPDATE public.scenarios SET roi = 1 WHERE id = '60000000-0000-4000-8000-000000000222';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Cross-tenant update succeeded'; END IF;
  BEGIN
    INSERT INTO public.scenarios(case_id,organization_id,scenario_type)
      VALUES ('40000000-0000-4000-8000-000000000222','20000000-0000-4000-8000-000000000222','upside');
    RAISE EXCEPTION 'Cross-tenant insert succeeded';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.assumptions SET organization_id = '20000000-0000-4000-8000-000000000222'
      WHERE id = '50000000-0000-4000-8000-000000000111';
    RAISE EXCEPTION 'Conflicting organization accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $rls$;
ROLLBACK;
