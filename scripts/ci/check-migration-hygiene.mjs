#!/usr/bin/env node

/**
 * CI guard: ensure migration files meet naming and uniqueness requirements.
 *
 * Rules enforced:
 *   1. All .sql files at the top level must match YYYYMMDDHHMMSS_description.sql
 *   2. No two migration files may share the same 14-digit timestamp prefix —
 *      duplicate timestamps produce undefined application order in the Supabase CLI.
 *
 * Directories starting with _ (e.g., _deferred_archived) are allowed and skipped.
 */

import { readdirSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = resolve(ROOT, "infra/supabase/supabase/migrations");

const TIMESTAMP_PATTERN = /^\d{14}_/;

console.log("🔍 Checking migration file hygiene...\n");

if (!existsSync(MIGRATIONS_DIR)) {
  console.log("  ⚠️  Migrations directory not found, skipping");
  process.exit(0);
}

const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
const formatViolations = [];
const timestampCounts = /** @type {Map<string, string[]>} */ (new Map());

for (const entry of entries) {
  // Allow directories (e.g., _deferred_archived)
  if (entry.isDirectory()) continue;

  // Allow non-SQL files
  if (!entry.name.endsWith(".sql")) continue;

  // Rule 1: must have a valid 14-digit timestamp prefix
  if (!TIMESTAMP_PATTERN.test(entry.name)) {
    formatViolations.push(entry.name);
    continue;
  }

  // Rule 2: collect timestamps to detect duplicates
  const ts = entry.name.slice(0, 14);
  if (!timestampCounts.has(ts)) timestampCounts.set(ts, []);
  timestampCounts.get(ts).push(entry.name);
}

const duplicateViolations = [...timestampCounts.entries()]
  .filter(([, files]) => files.length > 1);

let failed = false;

if (formatViolations.length > 0) {
  failed = true;
  console.error("  ❌ Non-timestamped SQL files found in migrations/:");
  for (const v of formatViolations) {
    console.error(`     - ${v}`);
  }
  console.error("\n  Move these to infra/supabase/sql/ops/ or add a proper timestamp prefix.");
}

if (duplicateViolations.length > 0) {
  failed = true;
  console.error("  ❌ Duplicate migration timestamps detected:");
  for (const [ts, files] of duplicateViolations) {
    console.error(`     Timestamp ${ts} used by ${files.length} files:`);
    for (const f of files) {
      console.error(`       - ${f}`);
    }
  }
  console.error(
    "\n  Duplicate timestamps produce undefined application order in the Supabase CLI." +
    "\n  Assign unique sequential timestamps (e.g., YYYYMMDDHHMMSS with different HHMMSS)."
  );
}

if (failed) {
  process.exit(1);
} else {
  console.log("  ✅ All migration files have valid, unique timestamp prefixes");
}
