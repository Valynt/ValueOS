#!/usr/bin/env node

/**
 * CI guard: enforce compose definitions under ops/compose only.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

const ROOT = resolve(import.meta.dirname, "../..");

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
  const hasServices = /^services:/m.test(content);
  const hasInclude = /^include:/m.test(content);

  if (hasServices && !hasInclude) {
    console.error(`  ❌ ${file}: defines services directly. Move to ops/compose/`);
    failures++;
  } else if (hasServices && hasInclude) {
    console.warn(`  ⚠️  ${file}: has both services and include — should only have include`);
  } else {
    console.log(`  ✅ ${file}: redirect only`);
  }
}

const canonicalPath = resolve(ROOT, "ops/compose/compose.yml");
if (!existsSync(canonicalPath)) {
  console.error("  ❌ ops/compose/compose.yml not found");
  failures++;
} else {
  console.log("  ✅ ops/compose/compose.yml exists");
}

const trackedComposeFiles = execSync(
  "git ls-files '*compose*.yml' '*compose*.yaml' '*docker-compose*.yml' '*docker-compose*.yaml'",
  { cwd: ROOT, encoding: "utf-8" }
)
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

for (const relativePath of trackedComposeFiles) {
  if (relativePath.startsWith("ops/compose/")) continue;
  // infra/docker/ is the canonical location for production compose files
  if (relativePath.startsWith("infra/docker/")) continue;

  const content = readFileSync(resolve(ROOT, relativePath), "utf-8");
  if (/^services:/m.test(content)) {
    console.error(
      `  ❌ ${relativePath}: compose service definitions are only allowed under ops/compose/`
    );
    failures++;
  }

  const invalidComposeRefRegex = /(?:^|\s)(?:-f|include:\s*\n(?:\s*-\s*)?)([^\s#]+(?:compose|docker-compose)[^\s#]*\.ya?ml)/gm;
  for (const match of content.matchAll(invalidComposeRefRegex)) {
    const ref = (match[1] || "").replace(/["']/g, "");
    if (!ref || ref.includes("ops/compose/")) continue;
    console.error(`  ❌ ${relativePath}: references non-canonical compose file '${ref}'`);
    failures++;
  }
}

console.log("");

if (failures > 0) {
  console.error(`❌ Compose drift check failed (${failures} issue(s))`);
  process.exit(1);
}

console.log("✅ Compose drift check passed");
