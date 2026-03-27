#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const logPath = resolve(ROOT, arg("--log", "artifacts/bundle/vite-build.log"));
const budgetPath = resolve(ROOT, arg("--budget", ".github/metrics/route-performance-budgets.json"));
const exceptionsPath = resolve(ROOT, arg("--exceptions", ".github/metrics/ux-budget-exceptions.json"));
const outPath = resolve(ROOT, arg("--out", "artifacts/bundle/route-chunk-budget-report.json"));
const exceptionId = process.env.UX_BUDGET_EXCEPTION_ID ?? "";

if (!existsSync(logPath) || !existsSync(budgetPath) || !existsSync(exceptionsPath)) {
  console.error("❌ Route chunk budget gate missing required inputs");
  process.exit(1);
}

const log = readFileSync(logPath, "utf-8");
const budgets = JSON.parse(readFileSync(budgetPath, "utf-8"));
const exceptions = JSON.parse(readFileSync(exceptionsPath, "utf-8"));

const routeChunkPattern = /([A-Za-z0-9_-]+)-[A-Za-z0-9_-]+\.js\s+([\d.]+)\s*kB(?:\s*\|\s*gzip:\s*([\d.]+)\s*kB)?/g;
const chunks = new Map();
for (const match of log.matchAll(routeChunkPattern)) {
  const name = match[1];
  const rawKb = Number(match[2]);
  const gzipKb = Number(match[3] ?? 0);
  const existing = chunks.get(name);
  if (!existing || rawKb > existing.rawKb) {
    chunks.set(name, { name, rawKb, gzipKb });
  }
}

const violations = [];
const routeResults = [];

for (const [chunkName, budget] of Object.entries(budgets.routes ?? {})) {
  const measured = chunks.get(chunkName);
  if (!measured) {
    violations.push(`Missing chunk metric for ${chunkName}`);
    continue;
  }

  const routeViolation = [];
  if (Number.isFinite(budget.maxRawKb) && measured.rawKb > budget.maxRawKb) {
    routeViolation.push(`raw ${measured.rawKb}KB > ${budget.maxRawKb}KB`);
  }
  if (Number.isFinite(budget.maxGzipKb) && measured.gzipKb > budget.maxGzipKb) {
    routeViolation.push(`gzip ${measured.gzipKb}KB > ${budget.maxGzipKb}KB`);
  }
  if (routeViolation.length > 0) {
    violations.push(`${chunkName}: ${routeViolation.join(", ")}`);
  }

  routeResults.push({
    chunkName,
    measured,
    budget,
    pass: routeViolation.length === 0,
    violations: routeViolation,
  });
}

const vendorName = budgets.sharedVendor?.chunkName ?? "vendor";
const vendor = chunks.get(vendorName);
if (!vendor) {
  violations.push(`Missing shared vendor chunk metric (${vendorName})`);
}

let vendorViolation = "";
if (vendor) {
  const baselineRawKb = Number(budgets.sharedVendor?.baselineRawKb ?? 0);
  const maxGrowthPercent = Number(budgets.sharedVendor?.maxGrowthPercent ?? 0);
  const allowedRawKb = Number((baselineRawKb * (1 + maxGrowthPercent / 100)).toFixed(2));
  if (vendor.rawKb > allowedRawKb) {
    vendorViolation = `shared ${vendorName} chunk ${vendor.rawKb}KB exceeds allowed ${allowedRawKb}KB (${maxGrowthPercent}% growth cap from ${baselineRawKb}KB)`;
    violations.push(vendorViolation);
  }
}

const now = new Date();
const activeException = (exceptions.exceptions ?? []).find((entry) => {
  if (entry.id !== exceptionId) return false;
  if (entry.status !== "active") return false;
  if (!entry.expiresOn) return false;
  return new Date(`${entry.expiresOn}T23:59:59Z`) >= now;
});

const exceptionApplied = Boolean(activeException) && Boolean(vendorViolation);
const effectiveViolations =
  exceptionApplied
    ? violations.filter((violation) => violation !== vendorViolation)
    : violations;

const output = {
  generatedAt: new Date().toISOString(),
  exceptionId,
  exceptionApplied,
  activeException,
  sharedVendor: vendor ? { ...vendor, violation: vendorViolation || null } : null,
  vendorViolation,
  pass: effectiveViolations.length === 0,
  routeResults,
  violations,
  effectiveViolations,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);

if (effectiveViolations.length > 0) {
  console.error("❌ Route chunk performance budgets failed");
  if (vendorViolation && !exceptionApplied) {
    console.error("  - Shared vendor guardrail breached without valid UX_BUDGET_EXCEPTION_ID");
  }
  for (const violation of effectiveViolations) console.error(`  - ${violation}`);
  process.exit(1);
}

if (exceptionApplied) {
  console.warn(`⚠️ Route chunk budgets passed with approved exception ${activeException.id}`);
} else {
  console.log("✅ Route chunk performance budgets passed");
}
