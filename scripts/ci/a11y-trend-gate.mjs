#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const reportPath = resolve(ROOT, arg("--report", "artifacts/accessibility/playwright-report.json"));
const baselinePath = resolve(ROOT, arg("--baseline", ".github/metrics/accessibility-baseline.json"));
const metricsPath = resolve(ROOT, arg("--metrics-out", "artifacts/accessibility/a11y-metrics.json"));
const summaryPath = resolve(ROOT, arg("--summary-out", "artifacts/accessibility/a11y-trend-summary.md"));

const report = JSON.parse(readFileSync(reportPath, "utf-8"));
const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));

let total = 0;
let passed = 0;
let failed = 0;
let keyboardTotal = 0;
let keyboardPassed = 0;

function walkSuite(suite) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      total += 1;
      const ok = (test.results ?? []).some((r) => r.status === "passed");
      if (ok) passed += 1;
      else failed += 1;

      const title = `${spec.title ?? ""} ${(test.annotations ?? []).map((a) => a.type).join(" ")}`.toLowerCase();
      if (title.includes("keyboard")) {
        keyboardTotal += 1;
        if (ok) keyboardPassed += 1;
      }
    }
  }

  for (const child of suite.suites ?? []) walkSuite(child);
}

for (const suite of report.suites ?? []) walkSuite(suite);

const passRate = total > 0 ? Number(((passed / total) * 100).toFixed(2)) : 0;
const keyboardCoverage = keyboardTotal > 0 ? Number(((keyboardPassed / keyboardTotal) * 100).toFixed(2)) : 0;

const metrics = {
  generatedAt: new Date().toISOString(),
  totals: { total, passed, failed, keyboardTotal, keyboardPassed },
  rates: { passRate, keyboardCoverage },
  baseline,
};

const thresholds = baseline.regressionThresholds;
const passRateDrop = baseline.passRate - passRate;
const keyboardDrop = baseline.keyboardCoverage - keyboardCoverage;
const failedDelta = failed - baseline.maxFailedTests;

const violations = [];
if (passRateDrop > thresholds.maxPassRateDrop) {
  violations.push(`Pass rate dropped ${passRateDrop.toFixed(2)} points (max ${thresholds.maxPassRateDrop})`);
}
if (keyboardDrop > thresholds.maxKeyboardCoverageDrop) {
  violations.push(`Keyboard coverage dropped ${keyboardDrop.toFixed(2)} points (max ${thresholds.maxKeyboardCoverageDrop})`);
}
if (failedDelta > thresholds.maxFailedTestsIncrease) {
  violations.push(`Failed tests increased by ${failedDelta} (max ${thresholds.maxFailedTestsIncrease})`);
}

mkdirSync(dirname(metricsPath), { recursive: true });
mkdirSync(dirname(summaryPath), { recursive: true });
writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);

const summary = [
  "# Accessibility Trend Summary",
  "",
  `- Pass rate: **${passRate}%** (baseline ${baseline.passRate}%)`,
  `- Keyboard coverage: **${keyboardCoverage}%** (baseline ${baseline.keyboardCoverage}%)`,
  `- Failed tests: **${failed}** (baseline max ${baseline.maxFailedTests})`,
  `- Status: **${violations.length ? "FAIL" : "PASS"}**`,
  "",
  violations.length
    ? `## Regressions\n${violations.map((v) => `- ❌ ${v}`).join("\n")}`
    : "## Regressions\n- ✅ No threshold regressions detected.",
].join("\n");
writeFileSync(summaryPath, `${summary}\n`);

if (violations.length) {
  console.error("❌ Accessibility regression gate failed");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("✅ Accessibility regression gate passed");
