#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, "packages/backend/tsconfig.strict-exceptions.json");

if (!fs.existsSync(configPath)) {
  console.error(`Missing strict exception config: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const include = Array.isArray(config.include) ? config.include : [];
const budgets = Array.isArray(config.strictExceptionBudgets)
  ? config.strictExceptionBudgets
  : [];
const protectedScopes = Array.isArray(config.strictExceptionProtectedScopes)
  ? config.strictExceptionProtectedScopes
  : [];

if (budgets.length === 0) {
  console.error(
    "No strictExceptionBudgets entries found in packages/backend/tsconfig.strict-exceptions.json.",
  );
  process.exit(1);
}

const includeScopes = include.filter(
  (entry) => !entry.startsWith("src/types/") && entry.endsWith(".ts"),
);

function countExceptionFiles(glob) {
  const repoGlob = `packages/backend/${glob}`;
  const args = [
    "--files",
    "-g",
    repoGlob,
    "-g",
    "!**/*.test.ts",
    "-g",
    "!**/*.spec.ts",
    "-g",
    "!**/__tests__/**",
    ".",
  ];
  const result = spawnSync("rg", args, { encoding: "utf8" });

  if (result.status === 1) {
    return 0;
  }

  if (result.status !== 0) {
    throw new Error(`ripgrep failed for ${repoGlob}: ${result.stderr || "unknown error"}`);
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

let regressions = 0;
let schemaErrors = 0;

const budgetPaths = new Set(budgets.map((budget) => budget.path));
for (const scope of includeScopes) {
  if (!budgetPaths.has(scope)) {
    console.error(`❌ Missing strictExceptionBudgets entry for include scope: ${scope}`);
    schemaErrors += 1;
  }
}

for (const scope of protectedScopes) {
  const violatingScope = includeScopes.find((entry) => entry.startsWith(scope));
  if (violatingScope) {
    console.error(
      `❌ Protected strict scope must not be covered by exception config: ${violatingScope}`,
    );
    regressions += 1;
  }
}

console.log("Strict exception debt budget status (packages/backend)");
for (const budget of budgets) {
  const isExceptionScope = includeScopes.includes(budget.path);
  const current = isExceptionScope ? countExceptionFiles(budget.path) : 0;
  const baseline = Number(budget.baseline ?? 0);
  const nextTarget = Number(budget.nextTarget ?? baseline);
  const delta = current - baseline;
  const gate = budget.gate === "zero-new" ? " [zero-new]" : "";
  const status = current <= baseline ? "✅" : "❌";

  console.log(
    `${status} ${budget.id}${gate}: current=${current}, baseline=${baseline}, delta=${delta >= 0 ? "+" : ""}${delta}, nextTarget=${nextTarget}, sunset=${budget.sunsetDate}`,
  );

  if (current > baseline) {
    regressions += 1;
  }
}

if (schemaErrors > 0 || regressions > 0) {
  const detail = [];
  if (schemaErrors > 0) detail.push(`${schemaErrors} schema issue(s)`);
  if (regressions > 0) detail.push(`${regressions} regression(s)`);
  console.error(`Strict exception ratchet failed: ${detail.join(", ")}.`);
  process.exit(1);
}

console.log("Strict exception ratchet passed (no regressions).");
