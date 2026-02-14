#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { dirname, extname, join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const budgetPath = resolve(ROOT, arg("--budget", ".github/metrics/ux-performance-budgets.json"));
const distAssetsPath = resolve(ROOT, arg("--dist-assets", "apps/ValyntApp/dist/assets"));
const routeMetricsPath = resolve(ROOT, arg("--route-metrics", "artifacts/performance/route-load-metrics.json"));
const outputPath = resolve(ROOT, arg("--output", "artifacts/performance/ux-performance-metrics.json"));

if (!existsSync(budgetPath)) {
  console.error(`❌ UX performance budget file not found: ${budgetPath}`);
  process.exit(1);
}
if (!existsSync(distAssetsPath)) {
  console.error(`❌ Build assets directory not found: ${distAssetsPath}`);
  process.exit(1);
}
if (!existsSync(routeMetricsPath)) {
  console.error(`❌ Route performance metrics not found: ${routeMetricsPath}`);
  process.exit(1);
}

const budgets = JSON.parse(readFileSync(budgetPath, "utf-8"));
const routeMetrics = JSON.parse(readFileSync(routeMetricsPath, "utf-8"));

const jsFiles = readdirSync(distAssetsPath)
  .filter((entry) => extname(entry) === ".js")
  .map((entry) => {
    const absolute = join(distAssetsPath, entry);
    const sizeBytes = statSync(absolute).size;
    return {
      file: `assets/${entry}`,
      sizeBytes,
      sizeKb: Number((sizeBytes / 1024).toFixed(2)),
    };
  });

const totalJsKb = Number((jsFiles.reduce((sum, file) => sum + file.sizeKb, 0)).toFixed(2));
const largestChunk = jsFiles.reduce(
  (max, file) => (file.sizeKb > max.sizeKb ? file : max),
  { file: "", sizeKb: 0 }
);

const violations = [];
const bundleBudgets = budgets.bundle ?? {};
if (Number.isFinite(bundleBudgets.maxTotalJsKb) && totalJsKb > bundleBudgets.maxTotalJsKb) {
  violations.push(`bundle.totalJsKb: ${totalJsKb} > budget ${bundleBudgets.maxTotalJsKb}`);
}
if (Number.isFinite(bundleBudgets.maxChunkJsKb) && largestChunk.sizeKb > bundleBudgets.maxChunkJsKb) {
  violations.push(`bundle.maxChunkJsKb (${largestChunk.file}): ${largestChunk.sizeKb} > budget ${bundleBudgets.maxChunkJsKb}`);
}

const routeBudgets = budgets.routeLoadMs ?? {};
const measuredRoutes = routeMetrics.routes ?? [];
for (const [route, budgetMs] of Object.entries(routeBudgets)) {
  const measured = measuredRoutes.find((entry) => entry.route === route);
  if (!measured) {
    violations.push(`route ${route}: no measured metric found`);
    continue;
  }
  if (measured.loadTimeMs > budgetMs) {
    violations.push(`route ${route}: ${measured.loadTimeMs}ms > budget ${budgetMs}ms`);
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  budgets,
  bundle: {
    totalJsKb,
    largestChunk,
    jsFiles,
  },
  routeLoad: {
    routes: measuredRoutes,
  },
  pass: violations.length === 0,
  violations,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf-8");

if (violations.length > 0) {
  console.error("❌ UX performance budget check failed");
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log("✅ UX performance budget check passed");
