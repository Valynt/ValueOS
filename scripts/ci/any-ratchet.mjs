#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const budgetPath = path.join(repoRoot, ".github/any-ratchet-budgets.json");

if (!fs.existsSync(budgetPath)) {
  console.error(`Missing any ratchet budget file: ${budgetPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(budgetPath, "utf8"));
const packageBudgets = config.packageBudgets ?? {};
const bucketBudgets = config.bucketBudgets ?? {};

const TEST_EXCLUDES = [
  "--glob",
  "!**/*.test.*",
  "--glob",
  "!**/*.spec.*",
  "--glob",
  "!**/__tests__/**",
];
const PATTERN = "(:\\s*any\\b|as\\s+any\\b|<any>)";
const DECLARATION_EXCLUDE = ["--glob", "!**/*.d.ts"];

function countAny(paths, options = {}) {
  const { excludeTests = true } = options;
  const normalizedPaths = Array.isArray(paths) ? paths : [paths];
  const args = ["-n", PATTERN, ...normalizedPaths, ...DECLARATION_EXCLUDE];
  if (excludeTests) {
    args.push(...TEST_EXCLUDES);
  }
  const result = spawnSync("rg", args, { encoding: "utf8" });

  if (result.status === 1) {
    return 0;
  }

  if (result.status !== 0) {
    const stderr = result.stderr || "unknown ripgrep error";
    throw new Error(`Failed to scan ${normalizedPaths.join(", ")}: ${stderr}`);
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function getBudgetPaths(name, cfg) {
  if (Array.isArray(cfg.paths) && cfg.paths.length > 0) {
    return cfg.paths;
  }

  if (name.startsWith("apps/") || name.startsWith("packages/")) {
    return [`${name}/src`];
  }

  return [name];
}

function evaluateBudgets(title, budgets) {
  let regressions = 0;
  console.log(title);

  for (const [name, cfg] of Object.entries(budgets)) {
    const paths = getBudgetPaths(name, cfg);
    const current = countAny(paths, { excludeTests: cfg.excludeTests !== false });
    const baseline = Number(cfg.baseline ?? 0);
    const nextTarget =
      cfg.nextTarget === undefined ? undefined : Number(cfg.nextTarget);

    if (current > baseline) {
      regressions += 1;
      console.error(`❌ ${name}: ${current} > baseline ${baseline}`);
    } else {
      console.log(`✅ ${name}: ${current} <= baseline ${baseline}`);
    }

    if (typeof nextTarget === "number" && current > nextTarget) {
      console.warn(`⚠️ ${name}: ${current} is above next target ${nextTarget}`);
    }
  }

  return regressions;
}

let regressions = 0;
regressions += evaluateBudgets("TypeScript any-usage ratchet status by package", packageBudgets);
if (Object.keys(bucketBudgets).length > 0) {
  console.log("");
  regressions += evaluateBudgets("TypeScript any-usage ratchet status by debt bucket", bucketBudgets);
}

if (regressions > 0) {
  console.error(`Any-usage ratchet regression in ${regressions} package(s).`);
  process.exit(1);
}

console.log("Any-usage ratchet check passed (no regressions).");
