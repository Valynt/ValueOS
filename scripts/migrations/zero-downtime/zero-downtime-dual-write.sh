#!/bin/bash
# zero-downtime-dual-write.sh
# Compatibility Phase: Apply schema changes to support both old and new app versions
# Usage: ./zero-downtime-dual-write.sh <DATABASE_URL>

set -euo pipefail

DB_URL=${1:-}
if [[ -z "$DB_URL" ]]; then
  echo "Usage: $0 <DATABASE_URL>"
  exit 1
fi

# Example: Add new columns/tables, keep legacy columns, add triggers for dual-write
psql "$DB_URL" <<'SQL'
-- Add new column for new app version, keep old column
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_email VARCHAR(255);

-- Create triggers to keep old and new columns in sync (example)
CREATE OR REPLACE FUNCTION sync_email_columns() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    NEW.new_email := NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_email_sync ON users;
CREATE TRIGGER users_email_sync BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_email_columns();
SQL

echo "[Zero-Downtime] Dual-write compatibility migration applied."
