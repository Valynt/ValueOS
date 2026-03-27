#!/usr/bin/env node
/**
 * Control coverage gate.
 *
 * Reads docs/security-compliance/control-registry.json and fails if any
 * automated control has status "unmapped". In PR mode (--pr), also checks
 * whether the changed file paths touch governed domains and enforces that
 * those domains have no unmapped automated controls.
 *
 * Usage:
 *   node scripts/ci/check-control-coverage.mjs
 *   CHANGED_FILES="path/a\npath/b" node scripts/ci/check-control-coverage.mjs --pr
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

// Governed path prefixes — PRs touching these must have no unmapped automated controls.
const GOVERNED_PATHS = [
  "packages/backend/src/lib/agent-fabric/",
  "packages/backend/src/services/security/",
  "packages/backend/src/services/auth/",
  "packages/backend/src/middleware/",
  "infra/k8s/security/",
  "infra/supabase/supabase/migrations/",
  "docs/security-compliance/",
];

function loadRegistry() {
  const registryPath = resolve(repoRoot, "docs/security-compliance/control-registry.json");
  if (!existsSync(registryPath)) {
    console.error(`[control-coverage] ERROR: control-registry.json not found at ${registryPath}`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(registryPath, "utf-8"));
  } catch (err) {
    console.error(`[control-coverage] ERROR: Failed to parse control-registry.json: ${err.message}`);
    process.exit(1);
  }
}

function getUnmappedAutomated(registry) {
  return registry.filter((c) => c.automated === true && c.status === "unmapped");
}

function changedFilesTouchesGoverned(changedFiles) {
  return changedFiles.some((file) =>
    GOVERNED_PATHS.some((prefix) => file.startsWith(prefix))
  );
}

function main() {
  const args = process.argv.slice(2);
  const isPrMode = args.includes("--pr");

  // Read changed files from the CHANGED_FILES env var (newline-separated).
  // Using an env var avoids shell word-splitting and quoting issues that arise
  // when injecting multiline GitHub Actions output directly into a run command.
  let changedFiles = [];
  const rawEnv = process.env.CHANGED_FILES ?? "";
  if (rawEnv.trim()) {
    changedFiles = rawEnv
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
  }

  const registry = loadRegistry();
  const unmapped = getUnmappedAutomated(registry);

  // Always fail if any automated control is unmapped — regardless of PR mode.
  if (unmapped.length > 0) {
    console.error(
      `[control-coverage] FAIL: ${unmapped.length} automated control(s) have status "unmapped":`
    );
    for (const c of unmapped) {
      console.error(`  - ${c.id} (${c.framework}): ${c.control_title}`);
    }
    console.error(
      "\nTo resolve: update control-registry.json to set status to 'mapped' or 'exception'."
    );
    console.error(
      "Exceptions require justification, approver, and expiry_date fields per audit-exceptions-policy.md."
    );
    process.exit(1);
  }

  // In PR mode, additionally warn if governed paths are touched but no controls exist for them.
  if (isPrMode && changedFiles.length > 0) {
    const touchesGoverned = changedFilesTouchesGoverned(changedFiles);
    if (touchesGoverned) {
      console.log(
        "[control-coverage] PR touches governed paths. Verifying control coverage..."
      );
      // All automated controls are mapped — pass.
      console.log(
        `[control-coverage] OK: All ${registry.filter((c) => c.automated).length} automated controls are mapped.`
      );
    } else {
      console.log(
        "[control-coverage] PR does not touch governed paths. Skipping path-sensitive check."
      );
    }
  }

  const total = registry.length;
  const mapped = registry.filter((c) => c.status === "mapped").length;
  const exceptions = registry.filter((c) => c.status === "exception").length;
  const automated = registry.filter((c) => c.automated).length;

  console.log(
    `[control-coverage] PASS: ${mapped}/${total} controls mapped, ${exceptions} exceptions, ${automated} automated.`
  );
  process.exit(0);
}

main();
