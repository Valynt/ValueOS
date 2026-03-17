/**
 * Integration-style tests for schema drift detection.
 *
 * These tests run without a live database. They use the same static-analysis
 * approach as check-migration-schema-consistency.mjs to verify that:
 *
 *   - schema_drift_is_detected: the declared schema (tables + columns derived
 *     from migrations) matches what the migration chain produces. Any column
 *     that appears in a snapshot but not in migrations is flagged as drift.
 *
 *   - fresh_database_bootstrap_matches_incremental_upgrade: the set of tables
 *     and columns produced by applying all migrations in order equals the set
 *     produced by the baseline migration alone plus all incremental migrations.
 *     (Static check — verifies no table is silently dropped and re-created with
 *     a different schema between the baseline and the tip of the chain.)
 *
 *   - failed_migration_state_is_detectable_and_safe: the schema_migrations
 *     tracking table contract is present in the canonical runner, and the
 *     runner uses ON_ERROR_STOP so partial application is detectable.
 *
 * The static analysis logic is self-contained here so these tests do not
 * depend on the CI scripts being importable as modules.
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const MIGRATIONS_DIR = resolve(ROOT, "infra/supabase/supabase/migrations");
const CANONICAL_RUNNER = resolve(ROOT, "scripts/db/apply-migrations.sh");

// ── SQL parsing helpers (mirrors check-migration-schema-consistency.mjs) ─────

function stripComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
}

function extractTableNames(sql: string): Set<string> {
  const clean = stripComments(sql);
  const pattern =
    /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?(\w+)/gi;
  const tables = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(clean)) !== null) {
    tables.add(m[1].toLowerCase());
  }
  return tables;
}

function extractTableBody(sql: string, tableName: string): string | null {
  const clean = stripComments(sql);
  // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is validated/controlled
  const headerPattern = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${tableName}\\s*\\(`,
    "i"
  );
  const headerMatch = headerPattern.exec(clean);
  if (!headerMatch) return null;

  let depth = 1;
  let i = headerMatch.index + headerMatch[0].length;
  const start = i;
  while (i < clean.length && depth > 0) {
    if (clean[i] === "(") depth++;
    else if (clean[i] === ")") depth--;
    i++;
  }
  return depth === 0 ? clean.slice(start, i - 1) : null;
}

function extractTableColumns(sql: string, tableName: string): Set<string> {
  const body = extractTableBody(sql, tableName);
  if (!body) return new Set();
  const cols = new Set<string>();
  const colPattern =
    /^\s{1,8}(\w+)\s+(?!CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN|LIKE)(\w)/gim;
  let cm: RegExpExecArray | null;
  while ((cm = colPattern.exec(body)) !== null) {
    cols.add(cm[1].toLowerCase());
  }
  return cols;
}

function extractAddedColumns(sql: string): Map<string, Set<string>> {
  const clean = stripComments(sql);
  const result = new Map<string, Set<string>>();
  const alterPattern =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)([\s\S]*?);/gi;
  let am: RegExpExecArray | null;
  while ((am = alterPattern.exec(clean)) !== null) {
    const table = am[1].toLowerCase();
    const body = am[2];
    const addColPattern =
      /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s/gi;
    let cm: RegExpExecArray | null;
    while ((cm = addColPattern.exec(body)) !== null) {
      const col = cm[1].toLowerCase();
      if (!result.has(table)) result.set(table, new Set());
      result.get(table)!.add(col);
    }
  }
  return result;
}

interface TableSchema {
  columns: Set<string>;
  definedInFile: string;
}

function buildSchemaFromDir(dir: string): Map<string, TableSchema> {
  if (!existsSync(dir)) return new Map();

  const files = readdirSync(dir)
    .filter(
      (f) =>
        f.endsWith(".sql") &&
        !f.endsWith(".rollback.sql") &&
        /^\d{14}_/.test(f)
    )
    .sort();

  const tableMap = new Map<string, TableSchema>();

  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");

    for (const tableName of extractTableNames(sql)) {
      if (!tableMap.has(tableName)) {
        tableMap.set(tableName, {
          columns: extractTableColumns(sql, tableName),
          definedInFile: file,
        });
      } else {
        for (const col of extractTableColumns(sql, tableName)) {
          tableMap.get(tableName)!.columns.add(col);
        }
      }
    }

    for (const [tableName, cols] of extractAddedColumns(sql)) {
      if (tableMap.has(tableName)) {
        for (const col of cols) tableMap.get(tableName)!.columns.add(col);
      }
    }
  }

  return tableMap;
}

// ── schema_drift_is_detected ──────────────────────────────────────────────────

describe("schema_drift_is_detected", () => {
  it("fixture: schema_snapshot.json with extra column is detected as drift", () => {
    const fixtureDir = resolve(__dirname, "fixtures/schema-drift");
    const snapshotPath = join(fixtureDir, "schema_snapshot.json");

    expect(existsSync(snapshotPath)).toBe(true);

    const snapshot: { tables: Record<string, { columns: string[] }> } =
      JSON.parse(readFileSync(snapshotPath, "utf8"));

    const schemaFromMigrations = buildSchemaFromDir(fixtureDir);

    const driftViolations: string[] = [];
    for (const [tableName, { columns: snapshotCols }] of Object.entries(
      snapshot.tables
    )) {
      const migrationSchema = schemaFromMigrations.get(tableName);
      if (!migrationSchema) {
        driftViolations.push(
          `Table "${tableName}" in snapshot has no CREATE TABLE in migrations`
        );
        continue;
      }
      for (const col of snapshotCols) {
        if (!migrationSchema.columns.has(col)) {
          driftViolations.push(
            `Column "${tableName}.${col}" is in snapshot but not in any migration`
          );
        }
      }
    }

    // The fixture has "manually_added_column" which is not in the migration
    expect(driftViolations.length).toBeGreaterThan(0);
    expect(driftViolations.some((v) => v.includes("manually_added_column"))).toBe(
      true
    );
  });

  it("active migration chain produces a consistent schema (no column added without IF NOT EXISTS guard when already present)", () => {
    // ADD COLUMN without any idempotency guard on a column that already exists
    // in the CREATE TABLE is a hard error on re-apply.
    //
    // Accepted idempotency forms:
    //   ADD COLUMN IF NOT EXISTS col ...          (SQL-level guard)
    //   DO $$ BEGIN IF NOT EXISTS ... ADD COLUMN  (PL/pgSQL guard)
    //
    // The static parser cannot see inside DO $$ ... $$ blocks, so we strip
    // PL/pgSQL blocks before scanning for bare ADD COLUMN statements.
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(
        (f) =>
          f.endsWith(".sql") &&
          !f.endsWith(".rollback.sql") &&
          /^\d{14}_/.test(f)
      )
      .sort();

    const tableMap = new Map<string, Set<string>>();
    const violations: string[] = [];

    for (const file of files) {
      const rawSql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");

      // Register new tables
      for (const tableName of extractTableNames(rawSql)) {
        if (!tableMap.has(tableName)) {
          tableMap.set(tableName, extractTableColumns(rawSql, tableName));
        } else {
          for (const col of extractTableColumns(rawSql, tableName)) {
            tableMap.get(tableName)!.add(col);
          }
        }
      }

      // Strip DO $$ ... $$ PL/pgSQL blocks — ADD COLUMN inside them is
      // guarded by IF NOT EXISTS checks that the static parser cannot see.
      const sqlWithoutPlpgsql = stripComments(rawSql).replace(
        /DO\s+\$\$[\s\S]*?\$\$/gi,
        " "
      );

      // Only flag ADD COLUMN without IF NOT EXISTS outside PL/pgSQL blocks
      const unsafeAddPattern =
        /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)[\s\S]*?ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS\s+)(\w+)\s/gi;
      let m: RegExpExecArray | null;
      while ((m = unsafeAddPattern.exec(sqlWithoutPlpgsql)) !== null) {
        const tableName = m[1].toLowerCase();
        const col = m[2].toLowerCase();
        const existing = tableMap.get(tableName);
        if (existing?.has(col)) {
          violations.push(
            `[${file}] ADD COLUMN "${col}" on "${tableName}" without IF NOT EXISTS — column already exists in the schema at this point`
          );
        }
        if (existing) existing.add(col);
      }
    }

    expect(
      violations,
      `Unsafe duplicate ADD COLUMN (missing IF NOT EXISTS guard):\n${violations.join("\n")}`
    ).toHaveLength(0);
  });

  it("every table in the active chain has at least one column defined", () => {
    const schemaMap = buildSchemaFromDir(MIGRATIONS_DIR);
    const empty: string[] = [];
    for (const [tableName, { columns, definedInFile }] of schemaMap) {
      if (columns.size === 0) {
        empty.push(`${tableName} (defined in ${definedInFile})`);
      }
    }
    expect(
      empty,
      `Tables with no columns extracted (parser may have failed):\n${empty.join("\n")}`
    ).toHaveLength(0);
  });
});

// ── fresh_database_bootstrap_matches_incremental_upgrade ─────────────────────

describe("fresh_database_bootstrap_matches_incremental_upgrade", () => {
  it("baseline migration (00000000000000) is the first file in sorted order", () => {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(
        (f) =>
          f.endsWith(".sql") &&
          !f.endsWith(".rollback.sql") &&
          /^\d{14}_/.test(f)
      )
      .sort();

    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/^00000000000000_/);
  });

  it("tables introduced in the baseline are not re-created with incompatible schemas in later migrations", () => {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(
        (f) =>
          f.endsWith(".sql") &&
          !f.endsWith(".rollback.sql") &&
          /^\d{14}_/.test(f)
      )
      .sort();

    if (files.length === 0) return;

    // Build baseline schema from the first file only
    const baselineSql = readFileSync(join(MIGRATIONS_DIR, files[0]), "utf8");
    const baselineTables = new Map<string, Set<string>>();
    for (const tableName of extractTableNames(baselineSql)) {
      baselineTables.set(tableName, extractTableColumns(baselineSql, tableName));
    }

    // Build full schema from all files
    const fullSchema = buildSchemaFromDir(MIGRATIONS_DIR);

    // Every column in the baseline must still exist in the full schema
    const regressions: string[] = [];
    for (const [tableName, baselineCols] of baselineTables) {
      const fullCols = fullSchema.get(tableName)?.columns;
      if (!fullCols) {
        regressions.push(
          `Table "${tableName}" exists in baseline but is absent from the full schema (was it dropped?)`
        );
        continue;
      }
      for (const col of baselineCols) {
        if (!fullCols.has(col)) {
          regressions.push(
            `Column "${tableName}.${col}" exists in baseline but is missing from the full schema`
          );
        }
      }
    }

    expect(
      regressions,
      `Schema regressions detected between baseline and tip of migration chain:\n${regressions.join("\n")}\n\nA fresh install and an incremental upgrade would produce different schemas.`
    ).toHaveLength(0);
  });

  it("no migration drops a table that was created in an earlier migration", () => {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(
        (f) =>
          f.endsWith(".sql") &&
          !f.endsWith(".rollback.sql") &&
          /^\d{14}_/.test(f)
      )
      .sort();

    const createdTables = new Set<string>();
    const violations: string[] = [];

    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const clean = stripComments(sql);

      // Register newly created tables
      for (const t of extractTableNames(sql)) createdTables.add(t);

      // Detect DROP TABLE statements
      const dropPattern =
        /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)/gi;
      let m: RegExpExecArray | null;
      while ((m = dropPattern.exec(clean)) !== null) {
        const dropped = m[1].toLowerCase();
        if (createdTables.has(dropped)) {
          violations.push(
            `[${file}] DROP TABLE "${dropped}" — table was created in an earlier migration. ` +
              `A fresh install and an incremental upgrade would diverge.`
          );
        }
      }
    }

    expect(
      violations,
      `DROP TABLE in forward migrations:\n${violations.join("\n")}`
    ).toHaveLength(0);
  });
});

// ── failed_migration_state_is_detectable_and_safe ────────────────────────────

describe("failed_migration_state_is_detectable_and_safe", () => {
  it("canonical runner uses ON_ERROR_STOP to prevent silent partial application", () => {
    const script = readFileSync(CANONICAL_RUNNER, "utf8");
    expect(
      script,
      "Canonical runner must pass -v ON_ERROR_STOP=1 to psql so a failed migration aborts immediately"
    ).toContain("ON_ERROR_STOP");
  });

  it("canonical runner maintains a schema_migrations tracking table", () => {
    const script = readFileSync(CANONICAL_RUNNER, "utf8");
    expect(
      script,
      "Canonical runner must create/use a schema_migrations table to track applied migrations"
    ).toContain("schema_migrations");
  });

  it("canonical runner skips already-applied migrations (idempotent re-run)", () => {
    const script = readFileSync(CANONICAL_RUNNER, "utf8");
    // The runner must check the tracking table before applying each file
    expect(script).toContain("schema_migrations");
    // Must use ON CONFLICT DO NOTHING or equivalent to handle re-runs
    expect(script).toMatch(/ON CONFLICT.*DO NOTHING|already.*up-to-date|_skipped/i);
  });

  it("fixture: partial-apply state is representable and detectable", () => {
    const fixturePath = resolve(
      __dirname,
      "fixtures/partial-apply/applied.json"
    );
    expect(existsSync(fixturePath)).toBe(true);

    const state: {
      applied: string[];
      pending: string[];
      failed: string;
    } = JSON.parse(readFileSync(fixturePath, "utf8"));

    // A partial state has both applied and pending migrations, with a failed entry
    expect(state.applied.length).toBeGreaterThan(0);
    expect(state.pending.length).toBeGreaterThan(0);
    expect(state.failed).toBeTruthy();

    // The failed migration must be in the pending list (not yet successfully applied)
    expect(state.pending).toContain(state.failed);

    // The failed migration must NOT be in the applied list
    expect(state.applied).not.toContain(state.failed);
  });

  it("migration-chain-integrity CI workflow fails fast on apply error", () => {
    const workflow = readFileSync(
      resolve(ROOT, ".github/workflows/migration-chain-integrity.yml"),
      "utf8"
    );
    // The workflow must use set -euo pipefail or ON_ERROR_STOP
    expect(workflow).toMatch(/set -euo pipefail|ON_ERROR_STOP/);
    // Must exit non-zero on failure
    expect(workflow).toContain("exit 1");
  });

  it("schema_migrations tracking table has RLS enabled in the canonical runner", () => {
    const script = readFileSync(CANONICAL_RUNNER, "utf8");
    // The runner creates the tracking table and must enable RLS on it
    expect(
      script,
      "schema_migrations tracking table must have RLS enabled to prevent cross-tenant reads"
    ).toContain("ENABLE ROW LEVEL SECURITY");
  });
});
