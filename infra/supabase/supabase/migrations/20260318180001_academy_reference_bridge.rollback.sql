-- Non-destructive Academy reference rollback: freeze writes, retain all
-- existing curriculum rows, RLS protections, constraints and relationships.
BEGIN;
SET LOCAL lock_timeout = '5s';
REVOKE INSERT, UPDATE, DELETE ON public.academy_modules,
  public.academy_lessons FROM authenticated, anon, PUBLIC, service_role;
COMMIT;
