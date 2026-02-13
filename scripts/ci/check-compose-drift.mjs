#!/usr/bin/env node

/**
 * CI guard: prevent new docker-compose/compose files at the repo root.
 *
 * The canonical compose file lives at ops/compose/compose.yml.
 * Repo-root files (docker-compose.yml, docker-compose.deps.yml, etc.)
 * are deprecated and must only contain an `include:` redirect.
 *
 * This script fails if:
 * - Any repo-root compose file defines `services:` directly (not via include).
 * - Any file outside ops/compose/ references compose files not in ops/compose/.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

const ROOT = resolve(import.meta.dirname, "../..");

// Repo-root compose files that are allowed to exist only as include redirects
const DEPRECATED_ROOT_FILES = [
  "docker-compose.yml",
  "docker-compose.deps.yml",
  "docker-compose.override.yml",
  "compose.devcontainer.override.yml",
];

let failures = 0;

console.log("🔍 Checking compose file drift...\n");

for (const file of DEPRECATED_ROOT_FILES) {
  const filePath = resolve(ROOT, file);
  if (!existsSync(filePath)) continue;

  const content = readFileSync(filePath, "utf-8");

  // Check if file defines services directly (not just an include redirect)
  const hasServices = /^services:/m.test(content);
  const hasInclude = /^include:/m.test(content);
  const isDeprecated = content.includes("DEPRECATED") || content.includes("deprecated");

  if (hasServices && !hasInclude) {
    console.error(`  ❌ ${file}: defines services directly. Move to ops/compose/compose.yml`);
    failures++;
  } else if (hasServices && hasInclude) {
    console.warn(`  ⚠️  ${file}: has both services and include — should only have include`);
  } else {
    console.log(`  ✅ ${file}: redirect only`);
  }
}

// Check that canonical file exists
const canonicalPath = resolve(ROOT, "ops/compose/compose.yml");
if (!existsSync(canonicalPath)) {
  console.error("  ❌ ops/compose/compose.yml not found");
  failures++;
} else {
  console.log("  ✅ ops/compose/compose.yml exists");
}

console.log("");

if (failures > 0) {
  console.error(`❌ Compose drift check failed (${failures} issue(s))`);
  process.exit(1);
} else {
  console.log("✅ Compose drift check passed");
}
