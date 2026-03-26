#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const args = process.argv.slice(2);
const reportIndex = args.indexOf("--report");
const policyIndex = args.indexOf("--policy");
const asOfIndex = args.indexOf("--as-of");

if (reportIndex === -1) {
  console.error("Usage: node scripts/ci/a11y-eslint-weekly-ratchet.mjs --report <eslint-json-path> [--policy <policy-json-path>] [--as-of YYYY-MM-DD]");
  process.exit(1);
}

const reportPath = path.resolve(repoRoot, args[reportIndex + 1]);
const policyPath = path.resolve(
  repoRoot,
  policyIndex === -1 ? ".github/metrics/a11y-eslint-ratchet.json" : args[policyIndex + 1]
);
const now = asOfIndex === -1 ? new Date() : new Date(`${args[asOfIndex + 1]}T00:00:00Z`);

if (Number.isNaN(now.valueOf())) {
  console.error("Invalid --as-of date. Use YYYY-MM-DD.");
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const policy = JSON.parse(readFileSync(policyPath, "utf8"));

const trackedRules = new Set(policy.rule_ids ?? []);
const trackedPrefix = policy.rule_prefix ?? "jsx-a11y/";

const warningCount = report.reduce((count, fileResult) => {
  const messages = fileResult.messages ?? [];
  return (
    count +
    messages.filter(message => {
      const isWarning = message.severity === 1;
      const ruleId = message.ruleId ?? "";
      return (
        isWarning &&
        (trackedRules.has(ruleId) || (trackedRules.size === 0 && ruleId.startsWith(trackedPrefix)))
      );
    }).length
  );
}, 0);

const startDate = new Date(`${policy.start_date}T00:00:00Z`);
if (Number.isNaN(startDate.valueOf())) {
  console.error(`Invalid policy start_date in ${policyPath}`);
  process.exit(1);
}

const msPerWeek = 7 * 24 * 60 * 60 * 1000;
const elapsedWeeks = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / msPerWeek));
const allowedWarnings = Math.max(0, policy.start_warning_count - elapsedWeeks * policy.weekly_reduction);

console.log("A11y ESLint weekly ratchet status");
console.log(`  As-of date:       ${now.toISOString().slice(0, 10)}`);
console.log(`  Policy start:     ${policy.start_date}`);
console.log(`  Elapsed weeks:    ${elapsedWeeks}`);
console.log(`  Weekly reduction: ${policy.weekly_reduction}`);
console.log(`  Allowed warnings: ${allowedWarnings}`);
console.log(`  Actual warnings:  ${warningCount}`);

if (warningCount > allowedWarnings) {
  console.error(
    `FAIL: jsx-a11y warning debt regression (${warningCount} > ${allowedWarnings}). ` +
      "Reduce warnings or update policy after confirmed net reduction."
  );
  process.exit(1);
}

console.log("PASS");
