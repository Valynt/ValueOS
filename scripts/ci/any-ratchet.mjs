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

const EXCLUDES = ["--glob", "!**/*.test.*", "--glob", "!**/*.spec.*", "--glob", "!**/__tests__/**"];
const PATTERN = "(:\\s*any\\b|as\\s+any\\b|<any>)";

function countAnyInPackage(packagePath) {
  const args = ["-n", PATTERN, `${packagePath}/src`, ...EXCLUDES];
  const result = spawnSync("rg", args, { encoding: "utf8" });

  if (result.status === 1) {
    return 0;
  }

  if (result.status !== 0) {
    const stderr = result.stderr || "unknown ripgrep error";
    throw new Error(`Failed to scan ${packagePath}: ${stderr}`);
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

let regressions = 0;
console.log("TypeScript any-usage ratchet status (non-test files)");

for (const [pkg, cfg] of Object.entries(packageBudgets)) {
  const current = countAnyInPackage(pkg);
  const baseline = Number(cfg.baseline ?? 0);
  const nextTarget = cfg.nextTarget === undefined ? undefined : Number(cfg.nextTarget);

  if (current > baseline) {
    regressions += 1;
    console.error(`❌ ${pkg}: ${current} > baseline ${baseline}`);
  } else {
    console.log(`✅ ${pkg}: ${current} <= baseline ${baseline}`);
  }

  if (typeof nextTarget === "number" && current > nextTarget) {
    console.warn(`⚠️ ${pkg}: ${current} is above next target ${nextTarget}`);
  }
}

if (regressions > 0) {
  console.error(`Any-usage ratchet regression in ${regressions} package(s).`);
  process.exit(1);
}

console.log("Any-usage ratchet check passed (no regressions).");
