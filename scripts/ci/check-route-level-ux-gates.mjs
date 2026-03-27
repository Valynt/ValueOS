#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const configPath = resolve(ROOT, arg("--config", ".github/metrics/route-level-quality-gates.json"));
const reportPath = resolve(ROOT, arg("--playwright", "artifacts/accessibility/playwright-report.json"));
const i18nPath = resolve(ROOT, arg("--i18n", "artifacts/i18n/coverage-dashboard.json"));
const outPath = resolve(ROOT, arg("--out", "artifacts/frontend-quality/route-level-gates.json"));

if (!existsSync(configPath) || !existsSync(reportPath) || !existsSync(i18nPath)) {
  console.error("❌ Route-level UX gate missing required inputs");
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf-8"));
const report = JSON.parse(readFileSync(reportPath, "utf-8"));
const i18n = JSON.parse(readFileSync(i18nPath, "utf-8"));

const routeStats = new Map();

function getSeverity(annotations = []) {
  const all = annotations
    .filter((annotation) => annotation.type === "a11y-violations" || annotation.type === "a11y-violations-all")
    .map((annotation) => `${annotation.description ?? ""}`.toLowerCase())
    .join("\n");

  const critical = (all.match(/\[critical\]/g) ?? []).length;
  const serious = (all.match(/\[serious\]/g) ?? []).length;
  return { critical, serious };
}

function walkSuite(suite) {
  for (const spec of suite.specs ?? []) {
    for (const testCase of spec.tests ?? []) {
      const routeAnn = (testCase.annotations ?? []).find((annotation) => annotation.type === "route-load");
      if (!routeAnn?.description) continue;

      let route = "";
      try {
        const parsed = JSON.parse(routeAnn.description);
        route = parsed.path ?? parsed.route ?? "";
      } catch {
        route = "";
      }
      if (!route) continue;

      const key = route.toLowerCase();
      if (!routeStats.has(key)) {
        routeStats.set(key, {
          route,
          total: 0,
          passed: 0,
          critical: 0,
          serious: 0,
        });
      }

      const current = routeStats.get(key);
      current.total += 1;
      const ok = (testCase.results ?? []).some((result) => result.status === "passed");
      if (ok) current.passed += 1;

      const severity = getSeverity(testCase.annotations ?? []);
      current.critical += severity.critical;
      current.serious += severity.serious;
    }
  }

  for (const child of suite.suites ?? []) walkSuite(child);
}

for (const suite of report.suites ?? []) walkSuite(suite);

const localesByName = new Map();
for (const directory of i18n.localeDirectories ?? []) {
  for (const locale of directory.locales ?? []) {
    localesByName.set(locale.locale, locale);
  }
}

const violations = [];
const journeyResults = [];

for (const journey of config.journeys ?? []) {
  let total = 0;
  let passed = 0;
  let critical = 0;
  let serious = 0;

  for (const route of journey.routes ?? []) {
    const stats = routeStats.get(route.toLowerCase());
    if (!stats) {
      violations.push(`${journey.name}: no accessibility evidence found for route ${route}`);
      continue;
    }
    total += stats.total;
    passed += stats.passed;
    critical += stats.critical;
    serious += stats.serious;
  }

  const passRate = total > 0 ? Number(((passed / total) * 100).toFixed(2)) : 0;
  const minPassRate = Number(journey.a11y?.minPassRate ?? 100);
  const maxCritical = Number(journey.a11y?.maxCritical ?? 0);
  const maxSerious = Number(journey.a11y?.maxSerious ?? 0);

  if (passRate < minPassRate) {
    violations.push(`${journey.name}: a11y pass rate ${passRate}% is below ${minPassRate}%`);
  }
  if (critical > maxCritical) {
    violations.push(`${journey.name}: critical violations ${critical} exceed budget ${maxCritical}`);
  }
  if (serious > maxSerious) {
    violations.push(`${journey.name}: serious violations ${serious} exceed budget ${maxSerious}`);
  }

  const localeResults = [];
  for (const locale of journey.l10n?.requiredLocales ?? []) {
    const localeSummary = localesByName.get(locale);
    const completeness = Number(localeSummary?.keyCompleteness ?? 0);
    const threshold = Number(journey.l10n?.minCompletenessPercent ?? 100);
    const ok = completeness >= threshold;

    if (!ok) {
      violations.push(`${journey.name}: locale ${locale} completeness ${completeness}% is below ${threshold}%`);
    }

    localeResults.push({ locale, completeness, threshold, pass: ok });
  }

  journeyResults.push({
    name: journey.name,
    routes: journey.routes,
    accessibility: { total, passed, passRate, critical, serious, minPassRate, maxCritical, maxSerious },
    localization: localeResults,
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  pass: violations.length === 0,
  journeys: journeyResults,
  violations,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);

if (violations.length > 0) {
  console.error("❌ Route-level UX gates failed");
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log("✅ Route-level UX gates passed");
