#!/usr/bin/env node

/**
 * CI guard: keep runtime compose definitions centralized in ops/compose/.
 *
 * This script focuses on the runtime/entry-point compose files used by local DX.
 * Legacy/archival compose files outside this scope are tolerated temporarily.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");

const RUNTIME_SHIMS = [
  "docker-compose.yml",
  "docker-compose.deps.yml",
  "compose.devcontainer.override.yml",
  ".devcontainer/docker-compose.yml",
  ".devcontainer/compose.devcontainer.override.yml",
  "infra/docker/docker-compose.dev.yml",
];

let failures = 0;

console.log("🔍 Checking compose file drift...\n");

for (const file of RUNTIME_SHIMS) {
  const fullPath = resolve(ROOT, file);
  if (!existsSync(fullPath)) continue;

  const content = readFileSync(fullPath, "utf-8");
  const hasServices = /^services:/m.test(content);
  const hasInclude = /^include:/m.test(content);

  if (hasServices) {
    console.error(`  ❌ ${file}: defines services outside ops/compose/ (must be include-only)`);
    failures++;
  } else if (!hasInclude) {
    console.error(`  ❌ ${file}: missing include: redirect to ops/compose/*`);
    failures++;
  } else {
    console.log(`  ✅ ${file}: include-only shim`);
  }
}

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
}

console.log("✅ Compose drift check passed");
