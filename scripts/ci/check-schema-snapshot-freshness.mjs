#!/usr/bin/env node

/**
 * CI guard: schema_snapshot.sql must be updated in the same commit/PR as
 * any migration file change.
 *
 * This check compares the git-modified file list against the migration
 * directory. If any migration was added or modified but docs/db/schema_snapshot.sql
 * was not touched in the same diff, the check fails.
 *
 * Requires: git, run inside a git repository with a valid HEAD.
 *
 * In CI, set BASE_SHA to the merge-base commit so the diff covers the full PR.
 * Locally, compares HEAD against the previous commit.
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const SNAPSHOT_PATH = "docs/db/schema_snapshot.sql";
const MIGRATIONS_DIR = "infra/supabase/supabase/migrations";

console.log("🔍 Checking schema snapshot freshness...\n");

if (!existsSync(resolve(ROOT, SNAPSHOT_PATH))) {
  console.error(`  ❌ Snapshot file not found: ${SNAPSHOT_PATH}`);
  console.error("  Generate it with: pg_dump ... --file docs/db/schema_snapshot.sql");
  process.exit(1);
}

// Determine the diff base: use BASE_SHA env var (set by CI) or fall back to HEAD~1.
const baseSha = process.env.BASE_SHA || "HEAD~1";

let changedFiles;
try {
  changedFiles = execSync(`git diff --name-only ${baseSha} HEAD`, {
    cwd: ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
} catch {
  // If git diff fails (e.g., shallow clone with no parent), skip the check.
  console.log("  ⚠️  Could not determine changed files via git diff — skipping snapshot check");
  process.exit(0);
}

const migrationChanges = changedFiles.filter(
  (f) => f.startsWith(MIGRATIONS_DIR) && f.endsWith(".sql") && !f.includes("/_")
);

const snapshotChanged = changedFiles.includes(SNAPSHOT_PATH);

if (migrationChanges.length === 0) {
  console.log("  ✅ No migration changes detected — snapshot check skipped");
  process.exit(0);
}

if (!snapshotChanged) {
  console.error("  ❌ Migration files changed but schema_snapshot.sql was not updated:\n");
  for (const f of migrationChanges) {
    console.error(`     ${f}`);
  }
  console.error(`
  Update the snapshot by applying migrations to a clean DB and running:

    pg_dump "$DIRECT_DATABASE_URL" \\
      --schema-only --no-owner --no-privileges --quote-all-identifiers \\
      --file docs/db/schema_snapshot.sql

  Then commit docs/db/schema_snapshot.sql in the same PR as the migration.
  See docs/db/migrations.md for the full workflow.`);
  process.exit(1);
}

console.log(
  `  ✅ schema_snapshot.sql updated alongside ${migrationChanges.length} migration change(s)`
);
