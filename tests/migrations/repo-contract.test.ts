/**
 * Repo contract tests for database migration discipline.
 *
 * These tests run without a live database. They inspect the repository
 * filesystem and CI configuration to enforce:
 *   - A single canonical migration source
 *   - No parallel/shadow migration directories
 *   - No ad hoc SQL execution paths outside the canonical runner
 *   - CI workflow coverage of the canonical path
 *
 * All tests are deterministic and require no external services.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { resolve, join, relative } from "path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

// ── canonical path ────────────────────────────────────────────────────────────

const CANONICAL_MIGRATIONS_DIR = resolve(
  ROOT,
  "infra/supabase/supabase/migrations"
);

const CANONICAL_RUNNER = resolve(ROOT, "scripts/db/apply-migrations.sh");

/**
 * Directories that exist but are explicitly documented as non-deployable.
 * Each must contain a README that says "DO NOT USE FOR RUNTIME MIGRATIONS".
 */
const KNOWN_LEGACY_DIRS = [
  "infra/migrations",
  "scripts/migrations",
  "scripts/prisma/migrations",
  "infra/supabase/supabase/db/migrations",
];

/**
 * Migration directories that serve a different database and are intentionally
 * separate from the main ValueOS migration pipeline.
 */
const SEPARATE_APP_MIGRATION_DIRS = ["apps/VOSAcademy/supabase/migrations"];

// ── helpers ───────────────────────────────────────────────────────────────────

function readTextFile(path: string): string {
  return readFileSync(path, "utf8");
}

function activeMigrationFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(
      (f) =>
        f.endsWith(".sql") &&
        !f.endsWith(".rollback.sql") &&
        /^\d{14}_/.test(f)
    )
    .sort();
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("canonical_migration_source_is_unique", () => {
  it("canonical migrations directory exists", () => {
    expect(
      existsSync(CANONICAL_MIGRATIONS_DIR),
      `Expected canonical migrations dir at ${CANONICAL_MIGRATIONS_DIR}`
    ).toBe(true);
  });

  it("canonical runner script exists", () => {
    expect(
      existsSync(CANONICAL_RUNNER),
      `Expected canonical runner at ${CANONICAL_RUNNER}`
    ).toBe(true);
  });

  it("canonical runner references the canonical migrations directory", () => {
    const script = readTextFile(CANONICAL_RUNNER);
    expect(script).toContain("infra/supabase/supabase/migrations");
  });

  it("legacy migration directories carry a DO-NOT-USE README", () => {
    const missing: string[] = [];
    for (const rel of KNOWN_LEGACY_DIRS) {
      const dir = resolve(ROOT, rel);
      if (!existsSync(dir)) continue; // directory removed — fine
      const readme = join(dir, "README.md");
      if (!existsSync(readme)) {
        missing.push(`${rel}: missing README.md`);
        continue;
      }
      const content = readTextFile(readme);
      if (!content.includes("DO NOT USE FOR RUNTIME MIGRATIONS")) {
        missing.push(
          `${rel}/README.md: does not contain "DO NOT USE FOR RUNTIME MIGRATIONS"`
        );
      }
    }
    expect(missing, missing.join("\n")).toHaveLength(0);
  });

  it("no deployable .sql files exist in legacy migration directories", () => {
    const violations: string[] = [];
    for (const rel of KNOWN_LEGACY_DIRS) {
      const dir = resolve(ROOT, rel);
      if (!existsSync(dir)) continue;
      // Walk one level deep only — sub-directories like zero-downtime/ are allowed
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".sql")) {
          violations.push(`${rel}/${entry.name}`);
        }
      }
    }
    expect(
      violations,
      `SQL files found in legacy directories (should be empty or contain only README):\n${violations.join("\n")}`
    ).toHaveLength(0);
  });

  it("separate app migration directories are not referenced by the canonical runner", () => {
    const script = readTextFile(CANONICAL_RUNNER);
    for (const rel of SEPARATE_APP_MIGRATION_DIRS) {
      expect(
        script,
        `Canonical runner must not reference separate app migration dir: ${rel}`
      ).not.toContain(rel);
    }
  });
});

describe("ci_rejects_parallel_migration_execution_paths", () => {
  const CI_WORKFLOW = resolve(ROOT, ".github/workflows/ci.yml");
  const DEPLOY_WORKFLOW = resolve(ROOT, ".github/workflows/deploy.yml");
  const MIGRATION_INTEGRITY_WORKFLOW = resolve(
    ROOT,
    ".github/workflows/migration-chain-integrity.yml"
  );

  it("migration-chain-integrity workflow exists", () => {
    expect(
      existsSync(MIGRATION_INTEGRITY_WORKFLOW),
      "Expected .github/workflows/migration-chain-integrity.yml"
    ).toBe(true);
  });

  it("migration-chain-integrity workflow targets only the canonical migrations directory", () => {
    const workflow = readTextFile(MIGRATION_INTEGRITY_WORKFLOW);
    expect(workflow).toContain("infra/supabase/supabase/migrations");
    // Must not reference legacy or shadow directories
    for (const rel of KNOWN_LEGACY_DIRS) {
      expect(
        workflow,
        `migration-chain-integrity.yml must not reference legacy dir: ${rel}`
      ).not.toContain(rel);
    }
  });

  it("CI unit-component-schema job runs migration hygiene checks", () => {
    const workflow = readTextFile(CI_WORKFLOW);
    expect(workflow).toContain("check-migration-hygiene.mjs");
    expect(workflow).toContain("check-migration-schema-consistency.mjs");
  });

  it("deploy workflow applies migrations via an approved runner only", () => {
    const workflow = readTextFile(DEPLOY_WORKFLOW);
    // Must use either the canonical shell runner or supabase db push (which
    // reads from infra/supabase/supabase — the canonical directory).
    const usesApprovedRunner =
      workflow.includes("apply-migrations.sh") ||
      workflow.includes("db:apply-migrations") ||
      workflow.includes("supabase db push");
    expect(
      usesApprovedRunner,
      "deploy.yml must apply migrations via apply-migrations.sh, db:apply-migrations, or supabase db push"
    ).toBe(true);
    // Must not reference prisma migrate or any legacy runner
    expect(workflow).not.toContain("prisma migrate");
    expect(workflow).not.toContain("scripts/migrations/");
    expect(workflow).not.toContain("infra/migrations/");
  });

  it("no workflow file applies migrations from a non-canonical directory", () => {
    const workflowsDir = resolve(ROOT, ".github/workflows");
    if (!existsSync(workflowsDir)) return;

    const violations: string[] = [];
    for (const file of readdirSync(workflowsDir)) {
      if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
      const content = readTextFile(join(workflowsDir, file));
      for (const rel of KNOWN_LEGACY_DIRS) {
        // Allow references that are clearly comments or documentation
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("#")) continue;
          if (trimmed.includes(rel) && trimmed.includes(".sql")) {
            violations.push(`${file}: references legacy migration path "${rel}"`);
          }
        }
      }
    }
    expect(
      violations,
      `Workflow files referencing non-canonical migration paths:\n${violations.join("\n")}`
    ).toHaveLength(0);
  });
});

describe("ad_hoc_sql_paths_are_blocked_or_flagged", () => {
  /**
   * Patterns that indicate a script is directly executing schema-altering SQL
   * outside the canonical migration pipeline.
   *
   * We scan scripts/ and apps/ for these patterns, excluding:
   *   - The canonical runner itself
   *   - Test files (they may legitimately set up schemas)
   *   - Files under node_modules
   */
  const SCHEMA_ALTER_PATTERNS = [
    /supabase\.rpc\(\s*['"]exec_sql['"]/,
    /\.query\(\s*['"`](?:ALTER|DROP|CREATE)\s+TABLE/i,
    /psql.*-c\s+['"](?:ALTER|DROP|CREATE)\s+TABLE/i,
  ];

  // scripts/db is included: the canonical runner files are in ALLOWED_FILES
  // and will be skipped; any new unapproved file added there will be caught.
  const SCAN_DIRS = ["scripts/migration", "scripts/db"];

  // The canonical runner is allowed to contain psql invocations
  const ALLOWED_FILES = new Set([
    resolve(ROOT, "scripts/db/apply-migrations.sh"),
    resolve(ROOT, "scripts/db/billing-migrate.sh"),
    resolve(ROOT, "scripts/ci/apply-and-rollback-migrations.sh"),
  ]);

  function scanDir(dir: string): string[] {
    const violations: string[] = [];
    if (!existsSync(dir)) return violations;

    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      const filePath = join(dir, entry.name);
      if (ALLOWED_FILES.has(filePath)) continue;

      // Skip test files
      if (
        entry.name.endsWith(".test.ts") ||
        entry.name.endsWith(".spec.ts") ||
        entry.name.endsWith(".test.js")
      )
        continue;

      const content = readTextFile(filePath);
      for (const pattern of SCHEMA_ALTER_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(
            `${relative(ROOT, filePath)}: matches ad hoc SQL pattern /${pattern.source}/`
          );
          break;
        }
      }
    }
    return violations;
  }

  it("scripts/migration/ and scripts/db/ contain no unapproved direct schema-altering SQL calls", () => {
    const violations: string[] = [];
    for (const rel of SCAN_DIRS) {
      violations.push(...scanDir(resolve(ROOT, rel)));
    }
    expect(
      violations,
      `Ad hoc schema-altering SQL found outside the migration pipeline:\n${violations.join("\n")}\n\nMove schema changes to infra/supabase/supabase/migrations/ as a timestamped migration file.`
    ).toHaveLength(0);
  });

  it("fixture: adhoc-sql-path/migrate_data.ts is detected as a violation", () => {
    // Validates the detection logic itself using the known-bad fixture.
    const fixture = resolve(
      __dirname,
      "fixtures/adhoc-sql-path/migrate_data.ts"
    );
    if (!existsSync(fixture)) return;
    const content = readTextFile(fixture);
    const matched = SCHEMA_ALTER_PATTERNS.some((p) => p.test(content));
    expect(
      matched,
      "Detection logic failed: adhoc fixture was not flagged by any pattern"
    ).toBe(true);
  });

  it("no unapproved migration runner is invoked in deploy scripts", () => {
    const deployScript = readTextFile(DEPLOY_WORKFLOW);
    // Unapproved runners that must not appear in the deploy workflow
    const unapprovedPatterns = [
      /prisma\s+migrate/i,
      /flyway/i,
      /liquibase/i,
      /scripts\/migrations\//,
      /infra\/migrations\//,
    ];
    for (const pattern of unapprovedPatterns) {
      expect(
        deployScript,
        `deploy.yml must not invoke unapproved migration runner matching /${pattern.source}/`
      ).not.toMatch(pattern);
    }
  });

  const DEPLOY_WORKFLOW = resolve(ROOT, ".github/workflows/deploy.yml");
});
