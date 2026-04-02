#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const backendRoot = path.join(repoRoot, "packages/backend");
const tsconfigPath = path.join(backendRoot, "tsconfig.strict-exceptions.json");

if (!fs.existsSync(tsconfigPath)) {
  console.error(`Missing strict exception config: ${tsconfigPath}`);
  process.exit(1);
}

const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
const include = Array.isArray(tsconfig.include) ? tsconfig.include : [];
const exclude = Array.isArray(tsconfig.exclude) ? tsconfig.exclude : [];
const budgets = Array.isArray(tsconfig.strictExceptionBudgets) ? tsconfig.strictExceptionBudgets : [];
const protectedZeroNewZones = Array.isArray(tsconfig.protectedZeroNewZones)
  ? tsconfig.protectedZeroNewZones
  : [];

if (budgets.length === 0) {
  console.error("strictExceptionBudgets is required and must contain at least one entry.");
  process.exit(1);
}

function filesForGlob(pattern) {
  const result = spawnSync("rg", ["--files", "src", "-g", pattern], {
    cwd: backendRoot,
    encoding: "utf8",
  });

  if (result.status === 1) {
    return [];
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || `Failed rg glob: ${pattern}`);
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function computeEffectiveSet(patterns) {
  const included = new Set();
  for (const pattern of patterns) {
    for (const file of filesForGlob(pattern)) {
      included.add(file);
    }
  }

  const excluded = new Set();
  for (const pattern of exclude) {
    for (const file of filesForGlob(pattern)) {
      excluded.add(file);
    }
  }

  return new Set([...included].filter((file) => !excluded.has(file)));
}

const effectiveFiles = computeEffectiveSet(include);
const effectiveTsFiles = [...effectiveFiles].filter((file) => file.endsWith(".ts"));

let failures = 0;

const budgetFileMap = new Map();
for (const entry of budgets) {
  const budgetEffectiveSet = computeEffectiveSet([entry.glob]);
  budgetFileMap.set(
    entry.glob,
    [...budgetEffectiveSet].filter((file) => file.endsWith(".ts")),
  );
}

for (const file of effectiveTsFiles) {
  const covered = budgets.some((entry) => budgetFileMap.get(entry.glob)?.includes(file));
  if (!covered) {
    console.error(`❌ include[] file is not covered by strictExceptionBudgets: ${file}`);
    failures += 1;
  }
}

console.log("Strict-exception budget status:");
for (const entry of budgets) {
  const files = budgetFileMap.get(entry.glob) ?? [];
  const current = files.length;
  const baseline = Number(entry.baseline ?? 0);
  const nextTarget = entry.nextTarget === undefined ? undefined : Number(entry.nextTarget);

  if (current === 0) {
    console.error(`❌ ${entry.glob}: matched 0 files. Check include[]/budget coverage.`);
    failures += 1;
    continue;
  }

  if (current > baseline) {
    console.error(`❌ ${entry.glob}: ${current} > baseline ${baseline}`);
    failures += 1;
  } else {
    console.log(`✅ ${entry.glob}: ${current} <= baseline ${baseline} (sunset ${entry.sunsetDate})`);
  }

  if (Number.isFinite(nextTarget) && current > nextTarget) {
    console.warn(`⚠️ ${entry.glob}: ${current} is above nextTarget ${nextTarget}`);
  }
}

for (const protectedGlob of protectedZeroNewZones) {
  const budget = budgets.find((entry) => entry.glob === protectedGlob);
  if (!budget) {
    console.error(`❌ protectedZeroNewZones entry missing from strictExceptionBudgets: ${protectedGlob}`);
    failures += 1;
    continue;
  }

  const current = (budgetFileMap.get(protectedGlob) ?? []).length;
  const baseline = Number(budget.baseline ?? 0);

  if (current > baseline) {
    console.error(`❌ protected zone regression ${protectedGlob}: ${current} > baseline ${baseline}`);
    failures += 1;
  } else {
    console.log(`✅ protected zone ${protectedGlob}: ${current} <= baseline ${baseline}`);
  }
}

if (failures > 0) {
  console.error(`Strict-exception budget check failed with ${failures} violation(s).`);
  process.exit(1);
}

console.log("Strict-exception budget check passed (no regressions; protected zones respected).");
