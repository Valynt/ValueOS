#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const reportPath = resolve(ROOT, arg("--report", "artifacts/accessibility/playwright-report.json"));
const budgetPath = resolve(ROOT, arg("--budget", ".github/metrics/wcag-severity-budgets.json"));
const metricsPath = resolve(ROOT, arg("--metrics-out", "artifacts/accessibility/wcag-severity-metrics.json"));

if (!existsSync(reportPath)) {
  console.error(`❌ Accessibility report not found: ${reportPath}`);
  process.exit(1);
}

if (!existsSync(budgetPath)) {
  console.error(`❌ WCAG severity budget file not found: ${budgetPath}`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, "utf-8"));
const budgetConfig = JSON.parse(readFileSync(budgetPath, "utf-8"));
const budgets = budgetConfig.budgets ?? {};

const severityCounts = {
  critical: 0,
  serious: 0,
  moderate: 0,
  minor: 0,
  unknown: 0,
};

function normalizeSeverity(value) {
  if (!value) return "unknown";
  const normalized = String(value).toLowerCase();
  if (["critical", "serious", "moderate", "minor"].includes(normalized)) return normalized;
  return "unknown";
}

function addFromText(text = "") {
  const matches = text.matchAll(/\[(critical|serious|moderate|minor)\]/gi);
  for (const match of matches) {
    const severity = normalizeSeverity(match[1]);
    severityCounts[severity] += 1;
  }
}

function walkSuite(suite) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      for (const annotation of test.annotations ?? []) {
        if (annotation.type === "a11y-violations") {
          addFromText(annotation.description);
        }
      }
    }
  }

  for (const child of suite.suites ?? []) {
    walkSuite(child);
  }
}

for (const suite of report.suites ?? []) {
  walkSuite(suite);
}

const violations = [];
for (const [severity, count] of Object.entries(severityCounts)) {
  const budget = Number.isFinite(budgets[severity]) ? budgets[severity] : Infinity;
  if (count > budget) {
    violations.push(`${severity}: ${count} > budget ${budget}`);
  }
}

const metrics = {
  generatedAt: new Date().toISOString(),
  reportPath,
  budgetPath,
  budgets,
  severityCounts,
  pass: violations.length === 0,
  violations,
};

mkdirSync(dirname(metricsPath), { recursive: true });
writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf-8");

if (violations.length > 0) {
  console.error("❌ WCAG severity budget check failed");
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log("✅ WCAG severity budget check passed");
