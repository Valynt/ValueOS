-- Allow subscription creation intents in pending_subscription_changes.
--
-- The original schema required old_plan_tier NOT NULL and subscription_id NOT NULL,
-- which was correct for plan-change intents. createSubscription() now also writes
-- intent records before calling Stripe, where no prior plan or subscription ID
-- exists yet. Make both columns nullable and distinguish creation intents by
-- old_plan_tier IS NULL.

BEGIN;

ALTER TABLE public.pending_subscription_changes
  ALTER COLUMN old_plan_tier DROP NOT NULL;

ALTER TABLE public.pending_subscription_changes
  ALTER COLUMN subscription_id DROP NOT NULL;

-- Update the CHECK constraint on old_plan_tier to allow NULL
ALTER TABLE public.pending_subscription_changes
  DROP CONSTRAINT IF EXISTS pending_subscription_changes_old_plan_tier_check;

ALTER TABLE public.pending_subscription_changes
  ADD CONSTRAINT pending_subscription_changes_old_plan_tier_check
  CHECK (old_plan_tier IS NULL OR old_plan_tier IN ('free', 'standard', 'enterprise'));

COMMENT ON COLUMN public.pending_subscription_changes.old_plan_tier IS
  'NULL for subscription creation intents; non-null for plan-change intents.';

COMMENT ON COLUMN public.pending_subscription_changes.subscription_id IS
  'NULL until the DB subscription record is written (creation intents only).';

COMMIT;
