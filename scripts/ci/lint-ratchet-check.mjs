#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

const args = process.argv.slice(2);
const laneIndex = args.indexOf("--lane");
const reportIndex = args.indexOf("--report");

if (laneIndex === -1 || reportIndex === -1) {
  console.error("Usage: node scripts/ci/lint-ratchet-check.mjs --lane <lane> --report <path>");
  process.exit(1);
}

const lane = args[laneIndex + 1];
const reportPath = resolve(ROOT, args[reportIndex + 1]);
const baselinePath = resolve(ROOT, "scripts/ci/lint-ratchet-baseline.json");

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const laneBaseline = baseline[lane];

if (!laneBaseline) {
  console.error(`No lint ratchet baseline configured for lane "${lane}" in ${baselinePath}`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const totals = report.reduce(
  (acc, fileResult) => {
    acc.errors += fileResult.errorCount ?? 0;
    acc.warnings += fileResult.warningCount ?? 0;
    return acc;
  },
  { errors: 0, warnings: 0 }
);

console.log(`Lint ratchet lane: ${lane}`);
console.log(`  Errors:   ${totals.errors} (baseline ${laneBaseline.errors})`);
console.log(`  Warnings: ${totals.warnings} (baseline ${laneBaseline.warnings})`);

if (totals.errors > laneBaseline.errors) {
  console.error(`FAIL: lint errors regressed for ${lane} (${totals.errors} > ${laneBaseline.errors})`);
  process.exit(1);
}

if (totals.warnings > laneBaseline.warnings) {
  console.error(`FAIL: lint warnings regressed for ${lane} (${totals.warnings} > ${laneBaseline.warnings})`);
  process.exit(1);
}

console.log("PASS");
