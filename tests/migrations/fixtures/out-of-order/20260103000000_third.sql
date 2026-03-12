-- migration 3 (applied first — simulates out-of-order insertion)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
