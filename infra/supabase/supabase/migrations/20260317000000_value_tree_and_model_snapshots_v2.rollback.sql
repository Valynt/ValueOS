-- Rollback: 20260317000000_value_tree_and_model_snapshots_v2
-- Removes columns added to value_tree_nodes and financial_model_snapshots.

BEGIN;

ALTER TABLE public.value_tree_nodes
  DROP COLUMN IF EXISTS node_key,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS driver_type,
  DROP COLUMN IF EXISTS impact_estimate,
  DROP COLUMN IF EXISTS confidence,
  DROP COLUMN IF EXISTS source_agent;

ALTER TABLE public.financial_model_snapshots
  DROP COLUMN IF EXISTS snapshot_version,
  DROP COLUMN IF EXISTS assumptions_json,
  DROP COLUMN IF EXISTS outputs_json,
  DROP COLUMN IF EXISTS source_agent;

COMMIT;
