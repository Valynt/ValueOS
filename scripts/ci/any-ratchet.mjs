#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  buildExplicitAnyRatchetViews,
  loadExplicitAnyBudgetEntries,
} from "./lib/explicit-any-budgets.mjs";

const repoRoot = process.cwd();
const pattern = "(:\\s*any\\b|as\\s+any\\b|<\\s*any\\s*>)";
const declarationExcludes = ["--glob", "!**/*.d.ts"];
const testExcludes = [
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

const { budgetPath, entries } = loadExplicitAnyBudgetEntries(repoRoot);
if (entries.length === 0) {
  console.log(`No explicit-any budget entries found in ${budgetPath}; skipping ratchet.`);
  process.exit(0);
}

const { packageBudgets, bucketBudgets } = buildExplicitAnyRatchetViews(entries);

function countAny(paths, options = {}) {
  const normalizedPaths = Array.isArray(paths) ? paths : [paths];
  const args = ["-n", pattern, ...normalizedPaths, ...declarationExcludes];

  if (options.excludeTests !== false) {
    args.push(...testExcludes);
  }

  const result = spawnSync("rg", args, { encoding: "utf8" });
  if (result.status === 1) {
    return 0;
  }
  if (result.status !== 0) {
    throw new Error(`Failed to scan ${normalizedPaths.join(", ")}: ${result.stderr || "unknown ripgrep error"}`);
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function evaluateBudgets(title, budgets) {
  let regressions = 0;
  console.log(title);

  for (const [name, cfg] of budgets.entries()) {
    const paths = [...cfg.paths];
    const current = countAny(paths, { excludeTests: cfg.excludeTests !== false });
    const baseline = Number(cfg.baseline ?? 0);
    const nextTarget = Number(cfg.nextTarget ?? baseline);

    if (current > baseline) {
      regressions += 1;
      console.error(`❌ ${name}: ${current} > baseline ${baseline}`);
    } else {
      console.log(`✅ ${name}: ${current} <= baseline ${baseline}`);
    }

    if (current > nextTarget) {
      console.warn(`⚠️ ${name}: ${current} is above next target ${nextTarget}`);
    }
  }

  return regressions;
}

let regressions = 0;
regressions += evaluateBudgets("TypeScript explicit-any ratchet status by package", packageBudgets);
console.log("");
regressions += evaluateBudgets("TypeScript explicit-any ratchet status by debt bucket", bucketBudgets);

if (regressions > 0) {
  console.error(`Explicit-any ratchet regression in ${regressions} package/bucket check(s).`);
  process.exit(1);
}

console.log("Explicit-any ratchet check passed (no regressions).");
