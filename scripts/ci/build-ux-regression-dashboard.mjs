#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

function readJson(path, required = true) {
  if (!existsSync(path)) {
    if (required) {
      console.error(`❌ Missing required input: ${path}`);
      process.exit(1);
    }
    return null;
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

const baselinePath = resolve(ROOT, arg("--baseline", ".github/metrics/ux-release-baselines.json"));
const a11yPath = resolve(ROOT, arg("--a11y", "artifacts/accessibility/a11y-metrics.json"));
const i18nPath = resolve(ROOT, arg("--i18n", "artifacts/i18n/coverage-dashboard.json"));
const perfPath = resolve(ROOT, arg("--perf", "artifacts/performance/ux-performance-metrics.json"));
const topTierPath = resolve(ROOT, arg("--top-tier", "artifacts/frontend-quality/top-tier-journey-gate.json"));
const jsonOut = resolve(ROOT, arg("--json-out", "artifacts/frontend-quality/regression-dashboard.json"));
const mdOut = resolve(ROOT, arg("--md-out", "artifacts/frontend-quality/regression-dashboard.md"));

const baseline = readJson(baselinePath);
const a11y = readJson(a11yPath);
const i18n = readJson(i18nPath);
const perf = readJson(perfPath, false);
const topTier = readJson(topTierPath, false);

const current = {
  accessibility: {
    passRate: a11y?.rates?.passRate ?? null,
    keyboardCoverage: a11y?.rates?.keyboardCoverage ?? null,
  },
  localization: {
    localesBelowCoverageThreshold: i18n?.totals?.localesBelowThreshold ?? null,
    localesBelowCompletenessThreshold: i18n?.totals?.localesBelowCompletenessThreshold ?? null,
  },
  performance: {
    totalJsKb: perf?.bundle?.totalJsKb ?? null,
    largestChunkKb: perf?.bundle?.largestChunk?.sizeKb ?? null,
    vendorChunkKb: perf?.bundle?.vendorChunk?.sizeKb ?? null,
  },
};

function delta(currentValue, baselineValue) {
  if (typeof currentValue !== "number" || typeof baselineValue !== "number") return null;
  return Number((currentValue - baselineValue).toFixed(2));
}

const comparison = {
  generatedAt: new Date().toISOString(),
  baseline,
  current,
  deltas: {
    accessibility: {
      passRate: delta(current.accessibility.passRate, baseline.accessibility?.passRate),
      keyboardCoverage: delta(current.accessibility.keyboardCoverage, baseline.accessibility?.keyboardCoverage),
    },
    localization: {
      localesBelowCoverageThreshold: delta(
        current.localization.localesBelowCoverageThreshold,
        baseline.localization?.localesBelowCoverageThreshold,
      ),
      localesBelowCompletenessThreshold: delta(
        current.localization.localesBelowCompletenessThreshold,
        baseline.localization?.localesBelowCompletenessThreshold,
      ),
    },
    performance: {
      totalJsKb: delta(current.performance.totalJsKb, baseline.performance?.totalJsKb),
      largestChunkKb: delta(current.performance.largestChunkKb, baseline.performance?.largestChunkKb),
      vendorChunkKb: delta(current.performance.vendorChunkKb, baseline.performance?.vendorChunkKb),
    },
  },
  topTierJourneys: topTier?.journeys ?? [],
};

const markdown = [
  "# UX Regression Dashboard",
  "",
  `Generated: ${comparison.generatedAt}`,
  `Baseline release: ${baseline.releaseId ?? "unknown"}`,
  "",
  "## Accessibility (vs previous release)",
  `- Pass rate: ${current.accessibility.passRate ?? "n/a"}% (Δ ${comparison.deltas.accessibility.passRate ?? "n/a"})`,
  `- Keyboard coverage: ${current.accessibility.keyboardCoverage ?? "n/a"}% (Δ ${comparison.deltas.accessibility.keyboardCoverage ?? "n/a"})`,
  "",
  "## Localization (vs previous release)",
  `- Locales below coverage threshold: ${current.localization.localesBelowCoverageThreshold ?? "n/a"} (Δ ${comparison.deltas.localization.localesBelowCoverageThreshold ?? "n/a"})`,
  `- Locales below completeness threshold: ${current.localization.localesBelowCompletenessThreshold ?? "n/a"} (Δ ${comparison.deltas.localization.localesBelowCompletenessThreshold ?? "n/a"})`,
  "",
  "## Route & bundle performance (vs previous release)",
  `- Total JS KB: ${current.performance.totalJsKb ?? "n/a"} (Δ ${comparison.deltas.performance.totalJsKb ?? "n/a"})`,
  `- Largest chunk KB: ${current.performance.largestChunkKb ?? "n/a"} (Δ ${comparison.deltas.performance.largestChunkKb ?? "n/a"})`,
  `- Vendor chunk KB: ${current.performance.vendorChunkKb ?? "n/a"} (Δ ${comparison.deltas.performance.vendorChunkKb ?? "n/a"})`,
  "",
  "## Top-tier journey snapshot",
  ...(topTier?.journeys ?? []).map((journey) => {
    const localeSummary = (journey.localization ?? [])
      .map((entry) => `${entry.locale}:${entry.completenessPercent}%`)
      .join(", ");
    return `- ${journey.name}: a11y critical=${journey.totals?.critical ?? "n/a"}, serious=${journey.totals?.serious ?? "n/a"}; l10n ${localeSummary || "n/a"}`;
  }),
];

mkdirSync(dirname(jsonOut), { recursive: true });
mkdirSync(dirname(mdOut), { recursive: true });
writeFileSync(jsonOut, `${JSON.stringify(comparison, null, 2)}\n`, "utf-8");
writeFileSync(mdOut, `${markdown.join("\n")}\n`, "utf-8");

console.log(`✅ UX regression dashboard written: ${jsonOut}`);
console.log(`✅ UX regression dashboard written: ${mdOut}`);
