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
const exceptionsPath = resolve(ROOT, arg("--exceptions", ".github/metrics/ux-performance-exceptions.json"));
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
const exceptions = existsSync(exceptionsPath)
  ? JSON.parse(readFileSync(exceptionsPath, "utf-8"))
  : { exceptions: [] };

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
const vendorChunk = jsFiles.find((file) => /vendor/i.test(file.file)) ?? null;

const violationEvents = [];
const bundleBudgets = budgets.bundle ?? {};
if (Number.isFinite(bundleBudgets.maxTotalJsKb) && totalJsKb > bundleBudgets.maxTotalJsKb) {
  violationEvents.push({ key: "bundle.totalJsKb", message: `bundle.totalJsKb: ${totalJsKb} > budget ${bundleBudgets.maxTotalJsKb}` });
}
if (Number.isFinite(bundleBudgets.maxChunkJsKb) && largestChunk.sizeKb > bundleBudgets.maxChunkJsKb) {
  violationEvents.push({
    key: "bundle.maxChunkJsKb",
    message: `bundle.maxChunkJsKb (${largestChunk.file}): ${largestChunk.sizeKb} > budget ${bundleBudgets.maxChunkJsKb}`,
  });
}

const routeBudgets = budgets.routeLoadMs ?? {};
const measuredRoutes = routeMetrics.routes ?? [];
for (const [route, budgetMs] of Object.entries(routeBudgets)) {
  const measured = measuredRoutes.find((entry) => entry.route === route);
  if (!measured) {
    violationEvents.push({ key: `route-load:${route}`, message: `route ${route}: no measured metric found` });
    continue;
  }
  if (measured.loadTimeMs > budgetMs) {
    violationEvents.push({ key: `route-load:${route}`, message: `route ${route}: ${measured.loadTimeMs}ms > budget ${budgetMs}ms` });
  }
}

const routeChunkBudgets = budgets.routeChunks ?? {};
for (const [chunkName, budget] of Object.entries(routeChunkBudgets)) {
  const matched = jsFiles
    .filter((file) => file.file.toLowerCase().includes(chunkName.toLowerCase()))
    .sort((a, b) => b.sizeKb - a.sizeKb)[0];

  if (!matched) {
    violationEvents.push({ key: `route-chunk:${chunkName}`, message: `route chunk '${chunkName}' not found in dist assets` });
    continue;
  }

  if (Number.isFinite(budget.maxKb) && matched.sizeKb > budget.maxKb) {
    violationEvents.push({
      key: `route-chunk:${chunkName}`,
      message: `route chunk '${chunkName}' (${matched.file}) ${matched.sizeKb}KB > budget ${budget.maxKb}KB`,
    });
  }
}

const vendorTrend = budgets.vendorTrend ?? {};
if (vendorTrend.enabled !== false) {
  if (!vendorChunk) {
    violationEvents.push({ key: "vendor-trend", message: "vendor chunk not found for trend guardrail" });
  } else {
    const baselineKb = Number(vendorTrend.baselineKb ?? vendorChunk.sizeKb);
    const growthPercent = baselineKb > 0
      ? Number((((vendorChunk.sizeKb - baselineKb) / baselineKb) * 100).toFixed(2))
      : 0;
    const maxGrowthPercent = Number(vendorTrend.maxGrowthPercent ?? 5);
    if (growthPercent > maxGrowthPercent) {
      violationEvents.push({
        key: "vendor-trend",
        message: `vendor trend growth ${growthPercent}% > allowed ${maxGrowthPercent}% (current ${vendorChunk.sizeKb}KB, baseline ${baselineKb}KB)`,
      });
    }
  }
}

const todayIso = new Date().toISOString().slice(0, 10);
function activeExceptionFor(key) {
  return (exceptions.exceptions ?? []).find((exception) => {
    if (!exception.guardrailKeys?.includes(key)) return false;
    if (!exception.expiresOn) return true;
    return exception.expiresOn >= todayIso;
  });
}

const unresolvedViolations = [];
const waivedViolations = [];
for (const violation of violationEvents) {
  const activeException = activeExceptionFor(violation.key);
  if (activeException) {
    waivedViolations.push({ ...violation, exception: activeException });
  } else {
    unresolvedViolations.push(violation);
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  budgets,
  exceptionsPath,
  bundle: {
    totalJsKb,
    largestChunk,
    vendorChunk,
    jsFiles,
  },
  routeLoad: {
    routes: measuredRoutes,
  },
  violations: unresolvedViolations,
  waivedViolations,
  pass: unresolvedViolations.length === 0,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf-8");

if (unresolvedViolations.length > 0) {
  console.error("❌ UX performance budget check failed");
  for (const violation of unresolvedViolations) console.error(`  - ${violation.message}`);
  process.exit(1);
}

if (waivedViolations.length > 0) {
  console.warn("⚠️ UX performance checks passed with approved exceptions:");
  for (const waived of waivedViolations) {
    console.warn(`  - ${waived.message} (exception: ${waived.exception.id}, expires ${waived.exception.expiresOn ?? "n/a"})`);
  }
}

console.log("✅ UX performance budget check passed");
