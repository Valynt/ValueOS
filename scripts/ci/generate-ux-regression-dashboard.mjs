#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const baselinePath = resolve(ROOT, arg("--baseline", ".github/metrics/ux-release-baseline.json"));
const a11yPath = resolve(ROOT, arg("--a11y", "artifacts/accessibility/a11y-metrics.json"));
const i18nPath = resolve(ROOT, arg("--i18n", "artifacts/i18n/coverage-dashboard.json"));
const perfPath = resolve(ROOT, arg("--perf", "artifacts/performance/route-load-metrics.json"));
const chunkPath = resolve(ROOT, arg("--chunk", "artifacts/bundle/route-chunk-budget-report.json"));
const mdPath = resolve(ROOT, arg("--md-out", "artifacts/frontend-quality/regression-dashboard.md"));
const jsonPath = resolve(ROOT, arg("--json-out", "artifacts/frontend-quality/regression-dashboard.json"));

if (![baselinePath, a11yPath, i18nPath, perfPath, chunkPath].every((path) => existsSync(path))) {
  console.error("❌ Regression dashboard inputs missing");
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
const a11y = JSON.parse(readFileSync(a11yPath, "utf-8"));
const i18n = JSON.parse(readFileSync(i18nPath, "utf-8"));
const perf = JSON.parse(readFileSync(perfPath, "utf-8"));
const chunk = JSON.parse(readFileSync(chunkPath, "utf-8"));

const currentA11y = {
  passRate: Number(a11y.rates?.passRate ?? 0),
  keyboardCoverage: Number(a11y.rates?.keyboardCoverage ?? 0),
  failedTests: Number(a11y.totals?.failed ?? 0),
};
const esLocale = (i18n.localeDirectories ?? [])
  .flatMap((entry) => entry.locales ?? [])
  .find((entry) => entry.locale === "es");
const currentL10n = {
  esCompleteness: Number(esLocale?.keyCompleteness ?? 0),
  localesBelowThreshold: Number(i18n.totals?.localesBelowThreshold ?? 0),
};
const currentPerf = {
  vendorRawKb: Number(chunk.sharedVendor?.rawKb ?? 0),
  routeLoadMs: Object.fromEntries((perf.routes ?? []).map((entry) => [entry.route, Number(entry.loadTimeMs)])),
};

function delta(current, previous) {
  return Number((current - previous).toFixed(2));
}

const comparison = {
  generatedAt: new Date().toISOString(),
  baselineRelease: baseline.release,
  accessibility: {
    passRateDelta: delta(currentA11y.passRate, baseline.accessibility.passRate),
    keyboardCoverageDelta: delta(currentA11y.keyboardCoverage, baseline.accessibility.keyboardCoverage),
    failedTestsDelta: delta(currentA11y.failedTests, baseline.accessibility.failedTests),
    current: currentA11y,
    baseline: baseline.accessibility,
  },
  localization: {
    esCompletenessDelta: delta(currentL10n.esCompleteness, baseline.localization.esCompleteness),
    localesBelowThresholdDelta: delta(currentL10n.localesBelowThreshold, baseline.localization.localesBelowThreshold),
    current: currentL10n,
    baseline: baseline.localization,
  },
  performance: {
    vendorRawKbDelta: delta(currentPerf.vendorRawKb, baseline.performance.vendorRawKb),
    routeLoadComparisons: Object.entries(baseline.performance.routeLoadMs ?? {}).map(([route, previous]) => ({
      route,
      baselineMs: Number(previous),
      currentMs: Number(currentPerf.routeLoadMs[route] ?? 0),
      deltaMs: delta(Number(currentPerf.routeLoadMs[route] ?? 0), Number(previous)),
    })),
    current: currentPerf,
    baseline: baseline.performance,
  },
};

const markdown = [
  "# UX Regression Dashboard",
  "",
  `Baseline release: **${comparison.baselineRelease}**`,
  "",
  "## Accessibility",
  `- Pass rate delta: ${comparison.accessibility.passRateDelta}%`,
  `- Keyboard coverage delta: ${comparison.accessibility.keyboardCoverageDelta}%`,
  `- Failed tests delta: ${comparison.accessibility.failedTestsDelta}`,
  "",
  "## Localization",
  `- Spanish completeness delta: ${comparison.localization.esCompletenessDelta}%`,
  `- Locales-below-threshold delta: ${comparison.localization.localesBelowThresholdDelta}`,
  "",
  "## Route performance",
  `- Shared vendor raw delta: ${comparison.performance.vendorRawKbDelta}KB`,
  "",
  "| Route | Baseline (ms) | Current (ms) | Delta (ms) |",
  "| --- | ---: | ---: | ---: |",
  ...comparison.performance.routeLoadComparisons.map((entry) => `| ${entry.route} | ${entry.baselineMs} | ${entry.currentMs} | ${entry.deltaMs} |`),
  "",
].join("\n");

mkdirSync(dirname(mdPath), { recursive: true });
mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(mdPath, `${markdown}\n`);
writeFileSync(jsonPath, `${JSON.stringify(comparison, null, 2)}\n`);

console.log(`✅ UX regression dashboard written to ${mdPath}`);
