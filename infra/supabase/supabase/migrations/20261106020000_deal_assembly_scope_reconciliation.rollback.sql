-- Non-destructive emergency write-freeze, not schema or data rollback.
-- Preserve rows, FK scope protection, RLS policies, triggers and mappings.
-- Stop external service-role traffic and review current grants before use.
-- Forward reapply restores the explicitly documented scoped grants.
BEGIN;
SET LOCAL lock_timeout = '5s';
REVOKE INSERT, UPDATE, DELETE ON
  public.deal_contexts, public.deal_context_sources,
  public.stakeholders, public.use_cases
  FROM authenticated, service_role;
COMMIT;
