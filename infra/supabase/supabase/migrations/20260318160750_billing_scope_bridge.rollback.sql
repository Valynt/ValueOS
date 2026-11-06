-- Non-destructive, security-preserving rollback. Does NOT undo columns,
-- backfills, policies, triggers, or restore unsafe organization-based access.
-- Stop external service-role writes before invoking this emergency write freeze.
-- Reapply the paired forward migration only after reviewing current state.
BEGIN;
SET LOCAL lock_timeout = '5s';
REVOKE INSERT, UPDATE, DELETE ON
  public.billing_price_versions, public.usage_policies,
  public.billing_approval_policies, public.billing_approval_requests,
  public.entitlement_snapshots
  FROM authenticated, service_role;
COMMIT;
