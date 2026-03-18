/**
 * Environment consistency tests for the migration pipeline.
 *
 * Verifies that local, CI, staging, and production all reference the same
 * canonical migration source and that no environment-specific shortcuts or
 * bypasses are present.
 *
 * No live database required. Tests inspect configuration files, workflow
 * definitions, and the canonical runner script.
 *
 * Covers:
 *   - environment_migration_contract_is_consistent
 *   - critical architecture controls are present in all declared environments
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

const CANONICAL_MIGRATIONS_DIR = "infra/supabase/supabase/migrations";
const CANONICAL_RUNNER = resolve(ROOT, "scripts/db/apply-migrations.sh");
const DEPLOY_WORKFLOW = resolve(ROOT, ".github/workflows/deploy.yml");
const CI_WORKFLOW = resolve(ROOT, ".github/workflows/ci.yml");
const MIGRATION_INTEGRITY_WORKFLOW = resolve(
  ROOT,
  ".github/workflows/migration-chain-integrity.yml"
);
const CRITICAL_CONTROLS_MANIFEST = resolve(
  ROOT,
  "scripts/ci/critical-architecture-controls.json"
);

// ── helpers ───────────────────────────────────────────────────────────────────

function readText(path: string): string {
  return readFileSync(path, "utf8");
}

function activeMigrationFiles(): string[] {
  const dir = resolve(ROOT, CANONICAL_MIGRATIONS_DIR);
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

// ── environment_migration_contract_is_consistent ──────────────────────────────

describe("environment_migration_contract_is_consistent", () => {
  it("canonical runner default MIGRATIONS_DIR points to the canonical path", () => {
    const script = readText(CANONICAL_RUNNER);
    // The default must be the canonical path, not a legacy or shadow directory
    expect(script).toContain(
      `MIGRATIONS_DIR:-$PROJECT_ROOT/${CANONICAL_MIGRATIONS_DIR}`
    );
  });

  it("billing-migrate.sh uses the same canonical migrations directory default", () => {
    const billingRunner = resolve(ROOT, "scripts/db/billing-migrate.sh");
    if (!existsSync(billingRunner)) return;
    const script = readText(billingRunner);
    expect(script).toContain(CANONICAL_MIGRATIONS_DIR);
  });

  it("staging deploy applies migrations from the canonical directory", () => {
    const workflow = readText(DEPLOY_WORKFLOW);
    // Extract the staging migration step's run block via regex so the
    // extraction is anchored to the step structure, not positional slicing.
    const stagingMatch = workflow.match(
      /- name: Run database migrations \(staging\)\s[\s\S]*?run:\s*\|([\s\S]*?)(?=\n\s{6}- name:)/
    );
    expect(stagingMatch, "Could not find staging migration step").toBeTruthy();
    const stagingSection = stagingMatch![1];
    // Confirm the extracted section does not bleed into the production step
    expect(stagingSection).not.toContain("Run database migrations (production)");
    // Must not reference legacy directories
    expect(stagingSection).not.toContain("scripts/migrations/");
    expect(stagingSection).not.toContain("infra/migrations/");
    expect(stagingSection).not.toContain("scripts/prisma/");
  });

  it("production deploy applies migrations from the canonical directory", () => {
    const workflow = readText(DEPLOY_WORKFLOW);
    const productionMatch = workflow.match(
      /- name: Run database migrations \(production\)\s[\s\S]*?run:\s*\|([\s\S]*?)(?=\n\s{6}- name:)/
    );
    expect(productionMatch, "Could not find production migration step").toBeTruthy();
    const prodSection = productionMatch![1];
    expect(prodSection).not.toContain("scripts/migrations/");
    expect(prodSection).not.toContain("infra/migrations/");
    expect(prodSection).not.toContain("scripts/prisma/");
  });

  it("staging and production use the same migration tool and target directory", () => {
    const workflow = readText(DEPLOY_WORKFLOW);

    // Extract the run block for each environment
    const stagingMatch = workflow.match(
      /Run database migrations \(staging\)[\s\S]*?run:\s*\|([\s\S]*?)(?=\n {6}- name:)/
    );
    const productionMatch = workflow.match(
      /Run database migrations \(production\)[\s\S]*?run:\s*\|([\s\S]*?)(?=\n {6}- name:)/
    );

    expect(stagingMatch, "Could not find staging migration step").toBeTruthy();
    expect(productionMatch, "Could not find production migration step").toBeTruthy();

    // Normalize: replace env-specific strings (secret names, env labels) and
    // collapse whitespace so only the structural command is compared.
    function normalizeCmd(raw: string): string {
      return raw
        .replace(/\$\{\{[^}]+\}\}/g, "ENV_VAR")          // replace all {{ }} expressions
        .replace(/STAGING_DATABASE_URL|PRODUCTION_DATABASE_URL/gi, "ENV_DB_URL")
        .replace(/staging deploys|production deploys/gi, "ENV deploys")
        .replace(/\s+/g, " ")
        .trim();
    }

    const stagingCmd = normalizeCmd(stagingMatch![1]);
    const productionCmd = normalizeCmd(productionMatch![1]);

    expect(stagingCmd).toEqual(productionCmd);
  });

  it("migration-chain-integrity workflow runs on the canonical directory path", () => {
    const workflow = readText(MIGRATION_INTEGRITY_WORKFLOW);
    expect(workflow).toContain(CANONICAL_MIGRATIONS_DIR);
  });

  it("CI unit-component-schema job does not skip migration checks", () => {
    const workflow = readText(CI_WORKFLOW);
    // The migration hygiene and consistency checks must not be conditional
    // on an env var that could be unset in CI
    const hygieneIdx = workflow.indexOf("check-migration-hygiene.mjs");
    expect(hygieneIdx).toBeGreaterThan(-1);

    // The line must not be prefixed with a conditional skip
    const lineStart = workflow.lastIndexOf("\n", hygieneIdx);
    const line = workflow.slice(lineStart, hygieneIdx + 50);
    expect(line).not.toMatch(/if\s+\[.*\]/);
    expect(line).not.toMatch(/\|\|\s*true/);
  });

  it("no environment-specific migration directory override is present in workflow env blocks", () => {
    const workflows = [DEPLOY_WORKFLOW, CI_WORKFLOW, MIGRATION_INTEGRITY_WORKFLOW];
    const violations: string[] = [];

    for (const wfPath of workflows) {
      if (!existsSync(wfPath)) continue;
      const content = readText(wfPath);
      // MIGRATIONS_DIR override pointing away from canonical is a violation
      const overridePattern = /MIGRATIONS_DIR:\s*(?!.*infra\/supabase\/supabase\/migrations)(.+)/g;
      let m: RegExpExecArray | null;
      while ((m = overridePattern.exec(content)) !== null) {
        const line = m[0].trim();
        // Allow comments
        if (line.startsWith("#")) continue;
        violations.push(`${wfPath.replace(ROOT + "/", "")}: ${line}`);
      }
    }

    expect(
      violations,
      `MIGRATIONS_DIR overrides pointing away from canonical path:\n${violations.join("\n")}`
    ).toHaveLength(0);
  });
});

// ── critical architecture controls ───────────────────────────────────────────

describe("critical_architecture_controls_are_present_in_all_environments", () => {
  it("critical-architecture-controls.json manifest exists", () => {
    expect(
      existsSync(CRITICAL_CONTROLS_MANIFEST),
      `Expected manifest at scripts/ci/critical-architecture-controls.json`
    ).toBe(true);
  });

  it("every required control migration file exists in the canonical directory", () => {
    const manifest: {
      requiredControls: Array<{ id: string; name: string; migration: string }>;
    } = JSON.parse(readText(CRITICAL_CONTROLS_MANIFEST));

    const missing: string[] = [];
    for (const control of manifest.requiredControls) {
      // Controls may live in the canonical dir or in the archived monolith subdir
      const canonicalPath = resolve(
        ROOT,
        CANONICAL_MIGRATIONS_DIR,
        control.migration
      );
      const archivedPath = resolve(
        ROOT,
        CANONICAL_MIGRATIONS_DIR,
        "_archived_monolith_20260213",
        control.migration
      );
      if (!existsSync(canonicalPath) && !existsSync(archivedPath)) {
        missing.push(
          `${control.id} (${control.name}): migration file "${control.migration}" not found`
        );
      }
    }

    expect(
      missing,
      `Required control migrations missing from canonical directory:\n${missing.join("\n")}`
    ).toHaveLength(0);
  });

  it("all declared environments in the manifest list the same required controls", () => {
    const manifest: {
      requiredControls: Array<{ migration: string }>;
      baselineEnvironments: Record<string, { appliedMigrations: string[] }>;
    } = JSON.parse(readText(CRITICAL_CONTROLS_MANIFEST));

    const requiredMigrations = new Set(
      manifest.requiredControls.map((c) => c.migration)
    );

    const violations: string[] = [];
    for (const [env, data] of Object.entries(manifest.baselineEnvironments)) {
      const applied = new Set(data.appliedMigrations);
      for (const required of requiredMigrations) {
        if (!applied.has(required)) {
          violations.push(
            `Environment "${env}" is missing required control migration: ${required}`
          );
        }
      }
    }

    expect(
      violations,
      `Environment baseline inconsistencies:\n${violations.join("\n")}\n\nAll environments must include all required control migrations.`
    ).toHaveLength(0);
  });

  it("verify-critical-architecture-migrations.mjs is invoked in CI", () => {
    // This script validates the manifest against the filesystem — it must run in CI.
    const ciWorkflow = readText(CI_WORKFLOW);
    const deployWorkflow = readText(DEPLOY_WORKFLOW);
    const isInCI = ciWorkflow.includes("verify-critical-architecture-migrations.mjs");
    const isInDeploy = deployWorkflow.includes("verify-critical-architecture-migrations.mjs");
    expect(
      isInCI || isInDeploy,
      "verify-critical-architecture-migrations.mjs must be invoked in ci.yml or deploy.yml"
    ).toBe(true);
  });

  it("local and CI environments declare the same baseline migrations", () => {
    const manifest: {
      baselineEnvironments: Record<string, { appliedMigrations: string[] }>;
    } = JSON.parse(readText(CRITICAL_CONTROLS_MANIFEST));

    const local = manifest.baselineEnvironments["local"];
    const ci = manifest.baselineEnvironments["ci"];

    if (!local || !ci) return; // environments not declared — skip

    const localSet = new Set(local.appliedMigrations);
    const ciSet = new Set(ci.appliedMigrations);

    const onlyInLocal = [...localSet].filter((m) => !ciSet.has(m));
    const onlyInCI = [...ciSet].filter((m) => !localSet.has(m));

    expect(
      onlyInLocal,
      `Migrations in local baseline but not CI:\n${onlyInLocal.join("\n")}`
    ).toHaveLength(0);

    expect(
      onlyInCI,
      `Migrations in CI baseline but not local:\n${onlyInCI.join("\n")}`
    ).toHaveLength(0);
  });

  it("canonical runner refuses to run against a non-local database without explicit opt-in", () => {
    const script = readText(CANONICAL_RUNNER);
    // The runner must have a guard that blocks remote DB targets unless
    // ALLOW_REMOTE_DB_MIGRATIONS=true is set
    expect(script).toContain("ALLOW_REMOTE_DB_MIGRATIONS");
    expect(script).toContain("Refusing to run against non-local DATABASE_URL");
  });

  it("active migration chain contains all migrations declared in the critical controls manifest", () => {
    const manifest: {
      requiredControls: Array<{ id: string; migration: string }>;
    } = JSON.parse(readText(CRITICAL_CONTROLS_MANIFEST));

    const activeFiles = new Set(activeMigrationFiles());

    // Controls may live in the archived monolith subdir — check both locations
    const archivedDir = resolve(
      ROOT,
      CANONICAL_MIGRATIONS_DIR,
      "_archived_monolith_20260213"
    );
    const archivedFiles = existsSync(archivedDir)
      ? new Set(readdirSync(archivedDir).filter((f) => f.endsWith(".sql")))
      : new Set<string>();

    const missing: string[] = [];
    for (const control of manifest.requiredControls) {
      if (!activeFiles.has(control.migration) && !archivedFiles.has(control.migration)) {
        missing.push(`${control.id}: ${control.migration}`);
      }
    }

    expect(
      missing,
      `Required control migrations not found in active chain or archived foundation:\n${missing.join("\n")}`
    ).toHaveLength(0);
  });
});
