#!/usr/bin/env node

import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, extname, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const BUDGET_FILE = join(ROOT, "config/readiness-budgets.json");
const OUT_FILE = join(ROOT, "artifacts/ci/ux-bundle-metrics.json");
const DIST_DIRS = ["apps/ValyntApp/dist"];

const config = JSON.parse(readFileSync(BUDGET_FILE, "utf-8"));
const budget = config.uxPerformance.bundleBudgets;

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

let scriptBytes = 0;
let stylesheetBytes = 0;
let totalBytes = 0;
let foundDist = false;

for (const rel of DIST_DIRS) {
  const dist = join(ROOT, rel);
  if (!existsSync(dist)) continue;
  foundDist = true;
  for (const file of walk(dist)) {
    const size = statSync(file).size;
    totalBytes += size;
    const ext = extname(file);
    if (ext === ".js") scriptBytes += size;
    if (ext === ".css") stylesheetBytes += size;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  budgets: budget,
  measured: { scriptBytes, stylesheetBytes, totalBytes },
};

mkdirSync(join(ROOT, "artifacts/ci"), { recursive: true });
writeFileSync(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

const failures = [];
if (!foundDist) failures.push("No dist directory found. Run frontend build before budget checks.");
if (scriptBytes > budget.scriptBytes) failures.push(`scriptBytes=${scriptBytes} > ${budget.scriptBytes}`);
if (stylesheetBytes > budget.stylesheetBytes) failures.push(`stylesheetBytes=${stylesheetBytes} > ${budget.stylesheetBytes}`);
if (totalBytes > budget.totalBytes) failures.push(`totalBytes=${totalBytes} > ${budget.totalBytes}`);

console.log(`Bundle sizes: script=${scriptBytes}, stylesheet=${stylesheetBytes}, total=${totalBytes}`);
console.log(`📊 Wrote bundle metrics to ${OUT_FILE}`);

if (failures.length) {
  console.error(`❌ Bundle budgets exceeded: ${failures.join(", ")}`);
  process.exit(1);
}

console.log("✅ Bundle budgets satisfied");
