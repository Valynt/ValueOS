-- Rollback: 00000000000000_initial_release_baseline
-- WARNING: This is the foundational billing schema baseline. Rolling back
-- drops all billing tables and is equivalent to a full schema wipe for the
-- billing subsystem. This script should only be executed as part of a
-- complete environment teardown, not as a targeted recovery operation.
--
-- For targeted recovery of individual tables, use the rollback scripts for
-- the specific migrations that introduced those tables.
--
-- Dependent objects from later migrations that must be dropped first:
--
--   From 20260304000000_tenant_provisioning_workflow:
--     - INDEX  idx_entitlement_snapshots_one_current_per_tenant  (on entitlement_snapshots)
--     - FUNCTION public.tenant_provisioning_workflow()
--
--   From 20260304010000_provision_tenant_rpc and
--        20260307000000_refresh_provision_tenant_rpc_contracts:
--     - FUNCTION public.provision_tenant()
--
-- These are dropped explicitly below so that the intent is clear and auditable.
-- CASCADE on the DROP TABLE statements handles any remaining FK constraints
-- within this migration's table set.

SET search_path = public, pg_temp;

-- Pre-flight: abort if any unexpected objects still depend on these tables.
-- This catches FK references added by migrations not listed above.
DO $$
DECLARE
  dep_count integer;
BEGIN
  SELECT COUNT(*)
    INTO dep_count
    FROM (
           -- Existing dependency check based on pg_depend.
           SELECT 1
             FROM pg_depend d
             JOIN pg_class c  ON c.oid  = d.objid
             JOIN pg_class ct ON ct.oid = d.refobjid
             JOIN pg_namespace n ON n.oid = ct.relnamespace
            WHERE n.nspname = 'public'
              AND ct.relname IN (
                    'billing_meters',
                    'billing_price_versions',
                    'usage_policies',
                    'billing_approval_policies',
                    'billing_approval_requests',
                    'entitlement_snapshots'
                  )
              AND d.deptype = 'n'
              AND c.relname NOT IN (
                    -- known dependents listed above; extend this list if new migrations
                    -- add FK references to these tables
                    'idx_entitlement_snapshots_one_current_per_tenant'
                  )

           UNION ALL

           -- Explicitly check for foreign key constraints referencing these tables.
           SELECT 1
             FROM pg_constraint fk
             JOIN pg_class referenced
               ON referenced.oid = fk.confrelid
             JOIN pg_namespace nref
               ON nref.oid = referenced.relnamespace
             JOIN pg_class referencing
               ON referencing.oid = fk.conrelid
             JOIN pg_namespace nrefg
               ON nrefg.oid = referencing.relnamespace
            WHERE fk.contype = 'f'
              AND nref.nspname = 'public'
              AND referenced.relname IN (
                    'billing_meters',
                    'billing_price_versions',
                    'usage_policies',
                    'billing_approval_policies',
                    'billing_approval_requests',
                    'entitlement_snapshots'
                  )
              AND referencing.relname NOT IN (
                    -- keep this in sync with the allow-list above if new dependents are added
                    'idx_entitlement_snapshots_one_current_per_tenant'
                  )
         ) deps;

  IF dep_count > 0 THEN
    RAISE EXCEPTION
      'Rollback aborted: % unexpected dependent object(s) found. '
      'Audit pg_depend for the tables listed in this script before proceeding.',
      dep_count;
  END IF;
END $$;

-- Drop known dependent functions from later migrations first.
-- Functions are not dropped by CASCADE on the tables they reference.
DROP FUNCTION IF EXISTS public.provision_tenant CASCADE;
DROP FUNCTION IF EXISTS public.tenant_provisioning_workflow CASCADE;

-- Drop the tables. CASCADE handles the entitlement_snapshots index and any
-- remaining intra-set FK constraints.
DROP TABLE IF EXISTS public.entitlement_snapshots CASCADE;
DROP TABLE IF EXISTS public.billing_approval_requests CASCADE;
DROP TABLE IF EXISTS public.billing_approval_policies CASCADE;
DROP TABLE IF EXISTS public.usage_policies CASCADE;
DROP TABLE IF EXISTS public.billing_price_versions CASCADE;
DROP TABLE IF EXISTS public.billing_meters CASCADE;
