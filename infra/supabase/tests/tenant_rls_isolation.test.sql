-- Verify tenant isolation via SET LOCAL app.tenant_id
DO $$
DECLARE
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  case_id uuid := gen_random_uuid();
  visible_count int := 0;
BEGIN
  PERFORM set_config('app.tenant_id', tenant_a::text, true);
  INSERT INTO public.memory_tenants (id, name, slug)
  VALUES (tenant_a, 'Tenant A', 'tenant-a');

  PERFORM set_config('app.tenant_id', tenant_b::text, true);
  INSERT INTO public.memory_tenants (id, name, slug)
  VALUES (tenant_b, 'Tenant B', 'tenant-b');

  PERFORM set_config('app.tenant_id', tenant_a::text, true);
  INSERT INTO public.memory_value_cases (id, tenant_id, title)
  VALUES (case_id, tenant_a, 'Tenant A Case');

  PERFORM set_config('app.tenant_id', tenant_b::text, true);
  SELECT COUNT(*) INTO visible_count
  FROM public.memory_value_cases
  WHERE id = case_id;

  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'RLS failed: tenant_b can read tenant_a data';
  END IF;
END $$;
