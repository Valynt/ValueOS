#!/usr/bin/env node

/**
 * CI guard: ensure only timestamped migration files exist in the migrations directory.
 *
 * Valid filenames: YYYYMMDDHHMMSS_description.sql
 * Archive directories (for example archive/) are allowed.
 *
 * Fails if any non-timestamp .sql file is found at the top level.
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
const violations = [];

for (const entry of entries) {
  // Allow directories (for example archive/)
  if (entry.isDirectory()) continue;

  // Allow non-SQL files
  if (!entry.name.endsWith(".sql")) continue;

  // Check timestamp pattern
  if (!TIMESTAMP_PATTERN.test(entry.name)) {
    violations.push(entry.name);
  }
}

if (violations.length > 0) {
  console.error("  ❌ Non-timestamped SQL files found in migrations/:");
  for (const v of violations) {
    console.error(`     - ${v}`);
  }
  console.error("\n  Move these to infra/supabase/sql/ops/ or add a proper timestamp prefix.");
  process.exit(1);
} else {
  console.log("  ✅ All migration files have valid timestamp prefixes");
}
