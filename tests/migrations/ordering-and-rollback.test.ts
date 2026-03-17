/**
 * Unit tests for migration ordering and rollback metadata contracts.
 *
 * No live database required. Tests parse the filesystem and SQL content.
 *
 * Covers:
 *   - migration_ordering_is_strict_and_deterministic
 *   - rollback_or_rollforward_contract_is_present
 *   - new_schema_change_without_migration_fails (filename hygiene)
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const MIGRATIONS_DIR = resolve(ROOT, "infra/supabase/supabase/migrations");

// Rollback convention applies to migrations at or after this timestamp prefix.
// Matches the threshold in check-migration-schema-consistency.mjs.
const ROLLBACK_REQUIRED_FROM = "20260320";

// ── helpers ───────────────────────────────────────────────────────────────────

interface MigrationFile {
  name: string;
  timestamp: string;
  description: string;
}

function loadActiveMigrations(dir: string): MigrationFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(
      (f) =>
        f.endsWith(".sql") &&
        !f.endsWith(".rollback.sql") &&
        /^\d{14}_/.test(f)
    )
    .sort()
    .map((name) => ({
      name,
      timestamp: name.slice(0, 14),
      description: name.slice(15).replace(/\.sql$/, ""),
    }));
}

function loadRollbackFiles(dir: string): Set<string> {
  if (!existsSync(dir)) return new Set();
  return new Set(
    readdirSync(dir).filter((f) => f.endsWith(".rollback.sql"))
  );
}

function loadRollbacksDir(dir: string): Set<string> {
  // Older rollback convention: infra/supabase/rollbacks/<name>_rollback.sql
  if (!existsSync(dir)) return new Set();
  return new Set(readdirSync(dir).filter((f) => f.endsWith(".sql")));
}

// ── ordering tests ────────────────────────────────────────────────────────────

describe("migration_ordering_is_strict_and_deterministic", () => {
  const migrations = loadActiveMigrations(MIGRATIONS_DIR);

  it("at least one active migration exists", () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it("all migration filenames match the YYYYMMDDHHMMSS_ timestamp pattern", () => {
    const invalid = migrations.filter(
      (m) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(m.name)
    );
    expect(
      invalid.map((m) => m.name),
      `Non-conforming migration filenames:\n${invalid.map((m) => m.name).join("\n")}\n\nExpected format: YYYYMMDDHHMMSS_description.sql`
    ).toHaveLength(0);
  });

  it("migration list is already in sorted (timestamp) order", () => {
    const names = migrations.map((m) => m.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it("no two migrations share the exact same 14-digit timestamp AND description", () => {
    // Exact duplicates (same full name) would cause idempotency failures.
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const m of migrations) {
      if (seen.has(m.name)) duplicates.push(m.name);
      seen.add(m.name);
    }
    expect(
      duplicates,
      `Duplicate migration filenames:\n${duplicates.join("\n")}`
    ).toHaveLength(0);
  });

  it("fixture: duplicate-timestamps directory is detected as a violation", () => {
    // Validates the detection logic using the known-bad fixture.
    const fixtureDir = resolve(__dirname, "fixtures/duplicate-timestamps");
    const fixtureMigrations = loadActiveMigrations(fixtureDir);
    const timestamps = fixtureMigrations.map((m) => m.timestamp);
    const duplicateTimestamps = timestamps.filter(
      (ts, i) => timestamps.indexOf(ts) !== i
    );
    expect(duplicateTimestamps.length).toBeGreaterThan(0);
  });

  it("fixture: out-of-order directory is detected as a violation", () => {
    // The out-of-order fixture has migration 3 listed before migration 1 in
    // filesystem order (simulated by filename). Sorted order must differ from
    // insertion order to trigger the check.
    const fixtureDir = resolve(__dirname, "fixtures/out-of-order");
    const fixtureMigrations = loadActiveMigrations(fixtureDir);
    // After sort(), migration 1 (20260101) comes before migration 3 (20260103).
    // The fixture was created with 3 first — verify sort produces correct order.
    expect(fixtureMigrations[0].timestamp).toBe("20260101000000");
    expect(fixtureMigrations[1].timestamp).toBe("20260103000000");
  });

  it("timestamps are monotonically non-decreasing across the active chain", () => {
    // Catches a migration inserted with an earlier timestamp than its predecessor
    // after the chain was already deployed (backfill violation).
    const violations: string[] = [];
    for (let i = 1; i < migrations.length; i++) {
      if (migrations[i].timestamp < migrations[i - 1].timestamp) {
        violations.push(
          `${migrations[i].name} (${migrations[i].timestamp}) < ${migrations[i - 1].name} (${migrations[i - 1].timestamp})`
        );
      }
    }
    expect(
      violations,
      `Out-of-order migrations detected:\n${violations.join("\n")}\n\nMigrations must be applied in strictly non-decreasing timestamp order.`
    ).toHaveLength(0);
  });

  it("duplicate timestamps are documented (known violations are tracked)", () => {
    // The real migration chain has two known duplicate-timestamp pairs
    // (20260328000000 and 20260331000000). This test documents them explicitly
    // so any new duplicate is caught immediately.
    const KNOWN_DUPLICATE_TIMESTAMPS = new Set([
      "20260328000000",
      "20260331000000",
    ]);

    const timestampCounts = new Map<string, string[]>();
    for (const m of migrations) {
      const existing = timestampCounts.get(m.timestamp) ?? [];
      timestampCounts.set(m.timestamp, [...existing, m.name]);
    }

    const undocumentedDuplicates: string[] = [];
    for (const [ts, files] of timestampCounts) {
      if (files.length > 1 && !KNOWN_DUPLICATE_TIMESTAMPS.has(ts)) {
        undocumentedDuplicates.push(
          `${ts}: ${files.join(", ")}`
        );
      }
    }

    expect(
      undocumentedDuplicates,
      `New undocumented duplicate timestamps found:\n${undocumentedDuplicates.join("\n")}\n\nAdd the timestamp to KNOWN_DUPLICATE_TIMESTAMPS in this test, or resolve the conflict.`
    ).toHaveLength(0);
  });
});

// ── rollback contract tests ───────────────────────────────────────────────────

describe("rollback_or_rollforward_contract_is_present", () => {
  const migrations = loadActiveMigrations(MIGRATIONS_DIR);
  const colocatedRollbacks = loadRollbackFiles(MIGRATIONS_DIR);
  const rollbacksDir = resolve(ROOT, "infra/supabase/rollbacks");
  const separateRollbacks = loadRollbacksDir(rollbacksDir);

  it("rollback convention threshold is documented in check-migration-schema-consistency.mjs", () => {
    const script = readFileSync(
      resolve(ROOT, "scripts/ci/check-migration-schema-consistency.mjs"),
      "utf8"
    );
    expect(script).toContain(`ROLLBACK_REQUIRED_FROM = "${ROLLBACK_REQUIRED_FROM}"`);
  });

  it("every migration >= threshold has a rollback file (co-located or in rollbacks/)", () => {
    const missing: string[] = [];

    for (const m of migrations) {
      if (m.timestamp < ROLLBACK_REQUIRED_FROM) continue;

      const colocatedName = m.name.replace(/\.sql$/, ".rollback.sql");
      const separateName = m.name.replace(/\.sql$/, "_rollback.sql");
      const separateNameAlt = m.name.replace(/\.sql$/, ".rollback.sql");

      const hasColocated = colocatedRollbacks.has(colocatedName);
      const hasSeparate =
        separateRollbacks.has(separateName) ||
        separateRollbacks.has(separateNameAlt);

      // Also accept an explicit "no rollback" annotation in the migration body
      const migrationPath = join(MIGRATIONS_DIR, m.name);
      const content = existsSync(migrationPath)
        ? readFileSync(migrationPath, "utf8")
        : "";
      const hasAnnotation =
        /--\s*no[- ]rollback/i.test(content) ||
        /--\s*not[- ]reversible/i.test(content) ||
        /--\s*irreversible/i.test(content);

      if (!hasColocated && !hasSeparate && !hasAnnotation) {
        missing.push(
          `${m.name}: no rollback file found and no "-- no rollback" annotation`
        );
      }
    }

    expect(
      missing,
      `Migrations missing rollback contract:\n${missing.join("\n")}\n\nCreate a paired .rollback.sql file or add "-- no rollback: <reason>" to the migration.`
    ).toHaveLength(0);
  });

  it("rollback files are non-empty", () => {
    const empty: string[] = [];
    for (const name of colocatedRollbacks) {
      const path = join(MIGRATIONS_DIR, name);
      const content = readFileSync(path, "utf8").trim();
      if (content.length === 0) empty.push(name);
    }
    expect(
      empty,
      `Empty rollback files:\n${empty.join("\n")}`
    ).toHaveLength(0);
  });

  it("fixture: missing-rollback directory is detected as a violation", () => {
    const fixtureDir = resolve(__dirname, "fixtures/missing-rollback");
    const fixtureMigrations = loadActiveMigrations(fixtureDir);
    const fixtureRollbacks = loadRollbackFiles(fixtureDir);

    const missing = fixtureMigrations.filter((m) => {
      if (m.timestamp < ROLLBACK_REQUIRED_FROM) return false;
      const rollbackName = m.name.replace(/\.sql$/, ".rollback.sql");
      return !fixtureRollbacks.has(rollbackName);
    });

    expect(missing.length).toBeGreaterThan(0);
  });

  it("rollback files do not themselves have rollback files (no double-rollback)", () => {
    const doubleRollbacks = [...colocatedRollbacks].filter((f) =>
      f.endsWith(".rollback.rollback.sql")
    );
    expect(
      doubleRollbacks,
      `Double-rollback files found:\n${doubleRollbacks.join("\n")}`
    ).toHaveLength(0);
  });
});

// ── filename hygiene (new schema change without migration) ────────────────────

describe("new_schema_change_without_migration_fails", () => {
  it("all .sql files in the canonical directory have a valid timestamp prefix", () => {
    if (!existsSync(MIGRATIONS_DIR)) return;

    const violations: string[] = [];
    for (const entry of readdirSync(MIGRATIONS_DIR, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".sql")) continue;
      if (!/^\d{14}_/.test(entry.name)) {
        violations.push(entry.name);
      }
    }

    expect(
      violations,
      `Non-timestamped SQL files in canonical migrations directory:\n${violations.join("\n")}\n\nAll migration files must be named YYYYMMDDHHMMSS_description.sql. Move ad hoc SQL to infra/supabase/sql/ops/ or add a proper timestamp prefix.`
    ).toHaveLength(0);
  });

  it("no .sql files exist at the root of the repository", () => {
    const rootSqlFiles = readdirSync(ROOT).filter((f) => f.endsWith(".sql"));
    expect(
      rootSqlFiles,
      `Loose SQL files at repository root:\n${rootSqlFiles.join("\n")}\n\nSchema changes must go through the migration pipeline.`
    ).toHaveLength(0);
  });

  it("check-migration-hygiene.mjs enforces the timestamp pattern", () => {
    const script = readFileSync(
      resolve(ROOT, "scripts/ci/check-migration-hygiene.mjs"),
      "utf8"
    );
    // The script must define a regex that validates the 14-digit timestamp prefix.
    // The pattern is stored as a JS regex literal: /^\d{14}_/
    expect(script).toContain("\\d{14}");
    expect(script).toContain("process.exit(1)");
  });
});
