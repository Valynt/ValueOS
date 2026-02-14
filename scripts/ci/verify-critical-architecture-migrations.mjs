#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = resolve(ROOT, "infra/supabase/supabase/migrations");
const MANIFEST_PATH = resolve(ROOT, "scripts/ci/critical-architecture-controls.json");

console.log("🔍 Verifying critical architecture migration controls...\n");

if (!existsSync(MANIFEST_PATH)) {
  console.error("❌ Missing manifest: scripts/ci/critical-architecture-controls.json");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const requiredControls = manifest.requiredControls ?? [];
const baselineEnvironments = manifest.baselineEnvironments ?? {};

let failures = 0;

for (const control of requiredControls) {
  const migrationPath = resolve(MIGRATIONS_DIR, control.migration);
  if (!existsSync(migrationPath)) {
    failures += 1;
    console.error(`❌ ${control.id} missing migration file: ${control.migration}`);
  } else {
    console.log(`✅ ${control.id} migration present: ${control.migration}`);
  }
}

for (const [environment, data] of Object.entries(baselineEnvironments)) {
  let environmentFailures = 0;
  const applied = new Set((data?.appliedMigrations ?? []).map(String));
  for (const control of requiredControls) {
    if (!applied.has(control.migration)) {
      failures += 1;
      environmentFailures += 1;
      console.error(
        `❌ ${environment} baseline is missing required migration ${control.migration} for ${control.id}`,
      );
    }
  }

  if (environmentFailures === 0) {
    console.log(`✅ ${environment} baseline includes all required critical control migrations`);
  }
}

if (failures > 0) {
  console.error(`\n❌ Critical architecture migration verification failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log("\n✅ Critical architecture migration verification passed");
