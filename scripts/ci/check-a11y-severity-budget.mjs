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
const budgetPath = resolve(ROOT, arg("--budget", ".github/metrics/a11y-severity-budget.json"));
const metricsPath = resolve(ROOT, arg("--metrics-out", "artifacts/accessibility/a11y-severity-metrics.json"));

const report = JSON.parse(readFileSync(reportPath, "utf-8"));
const budget = JSON.parse(readFileSync(budgetPath, "utf-8"));

const severityCounts = {
  critical: 0,
  serious: 0,
  moderate: 0,
  minor: 0,
  unknown: 0,
};

function collectFromAnnotations(annotations = []) {
  for (const annotation of annotations) {
    if (annotation.type === "a11y-impact-counts") {
      try {
        const parsed = JSON.parse(annotation.description ?? "{}");
        for (const key of Object.keys(severityCounts)) {
          severityCounts[key] += Number(parsed[key] ?? 0);
        }
      } catch {
        severityCounts.unknown += 1;
      }
      continue;
    }

    if (annotation.type === "a11y-violations") {
      const desc = (annotation.description ?? "").toLowerCase();
      for (const impact of ["critical", "serious", "moderate", "minor"]) {
        const matches = desc.match(new RegExp(`\\[${impact}\\]`, "g"));
        severityCounts[impact] += matches?.length ?? 0;
      }
    }
  }
}

function walkSuite(suite) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      collectFromAnnotations(test.annotations ?? []);
    }
  }
  for (const child of suite.suites ?? []) {
    walkSuite(child);
  }
}

for (const suite of report.suites ?? []) {
  walkSuite(suite);
}

const limits = budget.maxViolationsByImpact ?? { critical: 0, serious: 0 };
const failures = [];

for (const [impact, max] of Object.entries(limits)) {
  const actual = severityCounts[impact] ?? 0;
  if (actual > max) {
    failures.push(`${impact} violations: ${actual} > budget ${max}`);
  }
}

const metrics = {
  generatedAt: new Date().toISOString(),
  budget,
  severityCounts,
  status: failures.length ? "fail" : "pass",
  failures,
};

mkdirSync(dirname(metricsPath), { recursive: true });
writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf-8");

if (failures.length > 0) {
  console.error("❌ Accessibility severity budget gate failed");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("✅ Accessibility severity budget gate passed");
