#!/usr/bin/env node

/**
 * CI guard: every active migration must have a corresponding rollback file.
 *
 * Convention:
 *   Migration:  infra/supabase/supabase/migrations/<timestamp>_<name>.sql
 *   Rollback:   infra/supabase/rollbacks/<timestamp>_<name>_rollback.sql
 *
 * Baseline migrations (timestamp 00000000000000) are excluded — they represent
 * the initial schema and cannot be meaningfully rolled back.
 * Directories starting with _ (e.g., _deferred_archived) are skipped.
 */

import { readdirSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = resolve(ROOT, "infra/supabase/supabase/migrations");
const ROLLBACKS_DIR  = resolve(ROOT, "infra/supabase/rollbacks");

const TIMESTAMP_PATTERN = /^(\d{14})_(.+)\.sql$/;
const BASELINE_TIMESTAMP = "00000000000000";

console.log("🔍 Checking migration rollback coverage...\n");

if (!existsSync(MIGRATIONS_DIR)) {
  console.log("  ⚠️  Migrations directory not found, skipping");
  process.exit(0);
}

if (!existsSync(ROLLBACKS_DIR)) {
  console.error(`  ❌ Rollbacks directory not found: ${ROLLBACKS_DIR}`);
  process.exit(1);
}

const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((e) => !e.isDirectory() && e.name.endsWith(".sql"))
  .map((e) => e.name);

const rollbacks = new Set(
  readdirSync(ROLLBACKS_DIR, { withFileTypes: true })
    .filter((e) => !e.isDirectory() && e.name.endsWith(".sql"))
    .map((e) => e.name)
);

const missing = [];

for (const migration of migrations) {
  const match = TIMESTAMP_PATTERN.exec(migration);
  if (!match) continue; // non-timestamped files caught by hygiene check

  const [, timestamp, name] = match;

  // Baseline and seed migrations (timestamp prefix 00000000) are excluded —
  // they represent the initial schema/data and cannot be meaningfully rolled back.
  if (timestamp.startsWith("00000000")) continue;

  const expectedRollback = `${timestamp}_${name}_rollback.sql`;
  if (!rollbacks.has(expectedRollback)) {
    missing.push({ migration, expectedRollback });
  }
}

if (missing.length > 0) {
  console.error("  ❌ Migrations missing rollback files:\n");
  for (const { migration, expectedRollback } of missing) {
    console.error(`     Migration: ${migration}`);
    console.error(`     Expected:  infra/supabase/rollbacks/${expectedRollback}\n`);
  }
  console.error(
    `  ${missing.length} migration(s) have no rollback file.` +
    "\n  Create a rollback file with the inverse DDL for each, or add a" +
    "\n  forward-fix comment if the change is irreversible."
  );
  process.exit(1);
} else {
  console.log(`  ✅ All ${migrations.filter(m => !m.startsWith(BASELINE_TIMESTAMP)).length} active migrations have rollback files`);
}
