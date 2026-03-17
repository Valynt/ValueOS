#!/usr/bin/env node

/**
 * CI guard: every timestamped migration must have a paired rollback file.
 *
 * For each `YYYYMMDDHHMMSS_description.sql` that is NOT itself a rollback,
 * a corresponding `YYYYMMDDHHMMSS_description.rollback.sql` must exist.
 *
 * Exits 1 if any forward migration is missing its rollback.
 */

import { readdirSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = resolve(ROOT, "infra/supabase/supabase/migrations");

const TIMESTAMP_PATTERN = /^\d{14}_/;

console.log("🔍 Checking migration rollback coverage...\n");

if (!existsSync(MIGRATIONS_DIR)) {
  console.log("  ⚠️  Migrations directory not found, skipping");
  process.exit(0);
}

const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
const missing = [];

for (const entry of entries) {
  if (entry.isDirectory()) continue;
  if (!entry.name.endsWith(".sql")) continue;
  if (!TIMESTAMP_PATTERN.test(entry.name)) continue;

  // Skip rollback files themselves
  if (entry.name.endsWith(".rollback.sql")) continue;

  // Skip the initial baseline migrations (pre-date the rollback requirement)
  if (entry.name.startsWith("00000000")) continue;

  const base = entry.name.replace(/\.sql$/, "");
  const rollback = `${base}.rollback.sql`;

  if (!existsSync(resolve(MIGRATIONS_DIR, rollback))) {
    missing.push(entry.name);
  }
}

if (missing.length > 0) {
  console.error("  ❌ Migrations missing rollback files:");
  for (const m of missing) {
    console.error(`     - ${m}`);
    console.error(`       Expected: ${m.replace(/\.sql$/, ".rollback.sql")}`);
  }
  console.error(
    "\n  Create a paired .rollback.sql for each migration listed above."
  );
  process.exit(1);
} else {
  console.log("  ✅ All migrations have paired rollback files");
}
