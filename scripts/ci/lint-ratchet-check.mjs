#!/usr/bin/env node

/**
 * ESLint warning ratchet — fails CI if the actual warning count exceeds
 * the declared --max-warnings ceiling in packages/backend/package.json.
 *
 * Also prints headroom so engineers know when to lower the ceiling.
 *
 * Usage: node scripts/ci/lint-ratchet-check.mjs
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

const pkgPath = resolve(ROOT, "packages/backend/package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const lintScript = pkg.scripts?.lint ?? "";
const ceilingMatch = lintScript.match(/--max-warnings[=\s]+(\d+)/);
if (!ceilingMatch) {
  console.error("Could not parse --max-warnings from packages/backend/package.json lint script");
  process.exit(1);
}
const ceiling = Number(ceilingMatch[1]);

let output;
try {
  output = execSync("npx eslint src/ --max-warnings=99999 2>&1", {
    cwd: resolve(ROOT, "packages/backend"),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
} catch (e) {
  output = e.stdout ?? "";
}

const summaryMatch = output.match(/(\d+) problems? \((\d+) errors?, (\d+) warnings?\)/);
if (!summaryMatch) {
  console.error("Could not parse ESLint output summary");
  console.error(output.slice(-500));
  process.exit(1);
}

const errors = Number(summaryMatch[2]);
const warnings = Number(summaryMatch[3]);
const headroom = ceiling - warnings;

console.log(`ESLint ratchet check`);
console.log(`  Errors:   ${errors}`);
console.log(`  Warnings: ${warnings} / ${ceiling} ceiling`);
console.log(`  Headroom: ${headroom}`);

if (warnings > ceiling) {
  console.error(`\nFAIL: Warning count (${warnings}) exceeds ceiling (${ceiling}).`);
  console.error(`Fix ${warnings - ceiling} warnings or do NOT increase the ceiling without ADR justification.`);
  process.exit(1);
}

if (headroom > 50) {
  console.log(`\nNote: ${headroom} headroom — consider reducing --max-warnings to ${warnings + 20} in packages/backend/package.json`);
}

console.log("\nPASS");
