#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const manifestPath = resolve(ROOT, arg("--manifest", "apps/ValyntApp/dist/.vite/manifest.json"));
const budgetPath = resolve(ROOT, arg("--budget", ".github/metrics/ux-performance-budgets.json"));
const metricsPath = resolve(ROOT, arg("--metrics-out", "artifacts/performance/ux-performance-metrics.json"));

if (!existsSync(manifestPath)) {
  console.error(`❌ Manifest not found: ${manifestPath}`);
  process.exit(1);
}
if (!existsSync(budgetPath)) {
  console.error(`❌ Budget file not found: ${budgetPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const budget = JSON.parse(readFileSync(budgetPath, "utf-8"));
const distRoot = resolve(manifestPath, "../../");

function toKiB(bytes) {
  return Number((bytes / 1024).toFixed(2));
}

function assetSize(relPath) {
  const fullPath = resolve(distRoot, relPath);
  return existsSync(fullPath) ? statSync(fullPath).size : 0;
}

function collectChunkTotal(entry) {
  const files = new Set([entry.file, ...(entry.css ?? []), ...(entry.assets ?? []), ...(entry.imports ?? [])]);
  let bytes = 0;
  for (const file of files) bytes += assetSize(file);
  return { files: [...files], bytes, kiB: toKiB(bytes) };
}

const mainEntryKey = Object.keys(manifest).find((key) => manifest[key]?.isEntry) ?? "index.html";
const mainEntry = manifest[mainEntryKey] ?? manifest["index.html"];

if (!mainEntry) {
  console.error("❌ Could not detect entry in Vite manifest");
  process.exit(1);
}

const initial = collectChunkTotal(mainEntry);
const routeMetrics = [];

for (const routeBudget of budget.routeBudgets ?? []) {
  const candidateKey = Object.keys(manifest).find((key) => key.includes(routeBudget.sourceIncludes));
  const entry = candidateKey ? manifest[candidateKey] : undefined;
  if (!entry) {
    routeMetrics.push({ route: routeBudget.route, sourceIncludes: routeBudget.sourceIncludes, missing: true });
    continue;
  }
  const totals = collectChunkTotal(entry);
  routeMetrics.push({
    route: routeBudget.route,
    sourceIncludes: routeBudget.sourceIncludes,
    manifestKey: candidateKey,
    ...totals,
    maxKiB: routeBudget.maxKiB,
    status: totals.kiB <= routeBudget.maxKiB ? "pass" : "fail",
  });
}

const failures = [];
const initialBudget = budget.initialBundle?.maxKiB;
if (Number.isFinite(initialBudget) && initial.kiB > initialBudget) {
  failures.push(`Initial bundle ${initial.kiB}KiB exceeds ${initialBudget}KiB`);
}

for (const route of routeMetrics) {
  if (route.missing) {
    failures.push(`Route budget target missing in build output: ${route.route} (${route.sourceIncludes})`);
    continue;
  }
  if (route.status === "fail") {
    failures.push(`Route ${route.route} ${route.kiB}KiB exceeds ${route.maxKiB}KiB`);
  }
}

const metrics = {
  generatedAt: new Date().toISOString(),
  budget,
  initialBundle: { ...initial, maxKiB: initialBudget, status: !Number.isFinite(initialBudget) || initial.kiB <= initialBudget ? "pass" : "fail" },
  routes: routeMetrics,
  status: failures.length ? "fail" : "pass",
  failures,
};

mkdirSync(dirname(metricsPath), { recursive: true });
writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf-8");

if (failures.length) {
  console.error("❌ UX performance budget gate failed");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("✅ UX performance budget gate passed");
