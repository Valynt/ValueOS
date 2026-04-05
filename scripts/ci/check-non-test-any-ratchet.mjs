#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const budgetPath = path.join(repoRoot, "config", "debt-budgets.json");
const pattern = "(:\\s*any\\b|as\\s+any\\b|<\\s*any\\s*>)";
const defaultExcludes = [
  "--glob",
  "!**/*.d.ts",
  "--glob",
  "!**/*.test.*",
  "--glob",
  "!**/*.spec.*",
  "--glob",
  "!**/*.bench.*",
  "--glob",
  "!**/__tests__/**",
  "--glob",
  "!**/tests/**",
];

if (!fs.existsSync(budgetPath)) {
  console.error(`Missing debt budgets config: ${budgetPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(budgetPath, "utf8"));
const entries = Array.isArray(config.entries)
  ? config.entries.filter((entry) => entry.metric === "explicitAny")
  : [];

if (entries.length === 0) {
  console.log("No explicit-any debt budget entries found; skipping ratchet.");
  process.exit(0);
}

let regressions = 0;
console.log("Non-test explicit-any ratchet status");
for (const entry of entries) {
  const budgetPathValue = entry.path;
  if (typeof budgetPathValue !== "string" || budgetPathValue.length === 0) {
    console.error(`❌ ${entry.id}: missing 'path' in config/debt-budgets.json`);
    regressions += 1;
    continue;
  }

  const args = ["-n", pattern, budgetPathValue, ...defaultExcludes];
  const result = spawnSync("rg", args, { encoding: "utf8" });

  if (result.status !== 0 && result.status !== 1) {
    console.error(`❌ ${entry.id}: failed to scan ${budgetPathValue}`);
    console.error(result.stderr || result.stdout);
    regressions += 1;
    continue;
  }

  const current =
    result.status === 1 || !result.stdout.trim()
      ? 0
      : result.stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean).length;
  const baseline = Number(entry.baseline ?? 0);
  const nextTarget = Number(entry.nextTarget ?? baseline);
  const delta = current - baseline;

  if (current > baseline) {
    regressions += 1;
    console.error(
      `❌ ${entry.id}: ${current} > baseline ${baseline} (nextTarget=${nextTarget}, delta=${delta >= 0 ? "+" : ""}${delta})`,
    );
    continue;
  }

  console.log(
    `✅ ${entry.id}: ${current} <= baseline ${baseline} (nextTarget=${nextTarget}, delta=${delta >= 0 ? "+" : ""}${delta})`,
  );
}

if (regressions > 0) {
  console.error(`Explicit-any ratchet regression in ${regressions} budget entr${regressions === 1 ? "y" : "ies"}.`);
  process.exit(1);
}

console.log("Explicit-any ratchet check passed (no regressions).");
