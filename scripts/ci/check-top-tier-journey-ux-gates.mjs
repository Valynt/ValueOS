#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { execSync } from "child_process";

const ROOT = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const policyPath = resolve(ROOT, arg("--policy", ".github/metrics/top-tier-journey-thresholds.json"));
const reportPath = resolve(ROOT, arg("--a11y-report", "artifacts/accessibility/playwright-report.json"));
const localeRootPath = resolve(ROOT, arg("--locale-root", "apps/ValyntApp/src/i18n/locales"));
const outputPath = resolve(ROOT, arg("--output", "artifacts/frontend-quality/top-tier-journey-gate.json"));

if (!existsSync(policyPath)) {
  console.error(`❌ Top-tier UX gate policy not found: ${policyPath}`);
  process.exit(1);
}
if (!existsSync(reportPath)) {
  console.error(`❌ Accessibility Playwright report not found: ${reportPath}`);
  process.exit(1);
}
if (!existsSync(localeRootPath)) {
  console.error(`❌ Locale root not found: ${localeRootPath}`);
  process.exit(1);
}

const policy = JSON.parse(readFileSync(policyPath, "utf-8"));
const report = JSON.parse(readFileSync(reportPath, "utf-8"));
const sourceLocale = policy.sourceLocale ?? "en";

function flattenTranslationKeys(input, prefix = "") {
  const keys = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return prefix ? [prefix] : keys;
  }
  for (const [key, value] of Object.entries(input)) {
    const scoped = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...flattenTranslationKeys(value, scoped));
    } else {
      keys.push(scoped);
    }
  }
  return keys;
}

function loadLocaleKeys(locale) {
  const localeDir = resolve(localeRootPath, locale);
  let files = [];
  try {
    files = execSync(`rg --files "${localeDir}" -g '*.json'`, { encoding: "utf-8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    files = [];
  }
  const keys = new Set();
  for (const file of files) {
    const content = JSON.parse(readFileSync(file, "utf-8"));
    for (const key of flattenTranslationKeys(content)) keys.add(key);
  }
  return keys;
}

function extractJourneyKeys(sourceGlobs) {
  const keys = new Set();
  const usagePattern = /(t|i18n\.t)\(["']([a-zA-Z0-9_.-]+)["']/g;
  for (const glob of sourceGlobs ?? []) {
    let files = [];
    try {
      files = execSync(`rg --files ${glob}`, { cwd: ROOT, encoding: "utf-8" })
        .split("\n")
        .filter(Boolean);
    } catch {
      files = [];
    }
    for (const file of files) {
      const content = readFileSync(resolve(ROOT, file), "utf-8");
      for (const match of content.matchAll(usagePattern)) keys.add(match[2]);
    }
  }
  return Array.from(keys).sort();
}

function parseSeverities(text = "") {
  const severity = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const matches = text.matchAll(/\[(critical|serious|moderate|minor)\]/gi);
  for (const match of matches) severity[match[1].toLowerCase()] += 1;
  return severity;
}

function collectA11yByRoute() {
  const byRoute = new Map();

  function walkSuite(suite) {
    for (const spec of suite.specs ?? []) {
      for (const testCase of spec.tests ?? []) {
        const routeAnnotation = (testCase.annotations ?? []).find((a) => a.type === "route-load");
        if (!routeAnnotation) continue;

        let routePath = null;
        try {
          const parsed = JSON.parse(routeAnnotation.description ?? "{}");
          routePath = parsed.path ?? null;
        } catch {
          routePath = null;
        }
        if (!routePath) continue;

        const violationsAnnotation = (testCase.annotations ?? []).find((a) => a.type === "a11y-violations");
        const severities = parseSeverities(violationsAnnotation?.description ?? "");
        byRoute.set(routePath, {
          routePath,
          critical: severities.critical,
          serious: severities.serious,
          moderate: severities.moderate,
          minor: severities.minor,
        });
      }
    }

    for (const child of suite.suites ?? []) walkSuite(child);
  }

  for (const suite of report.suites ?? []) walkSuite(suite);
  return byRoute;
}

const localeKeys = {};
for (const locale of [sourceLocale, ...(policy.targetLocales ?? [])]) {
  localeKeys[locale] = loadLocaleKeys(locale);
}

const a11yByRoute = collectA11yByRoute();
const journeys = [];
const violations = [];

for (const journey of policy.journeys ?? []) {
  const routeMetrics = (journey.routePaths ?? []).map((path) => {
    const metric = a11yByRoute.get(path) ?? { routePath: path, critical: 0, serious: 0, moderate: 0, minor: 0 };
    if (!a11yByRoute.has(path)) {
      violations.push(`${journey.id}: missing route-level a11y sample for ${path}`);
    }
    return metric;
  });

  const totalCritical = routeMetrics.reduce((sum, route) => sum + route.critical, 0);
  const totalSerious = routeMetrics.reduce((sum, route) => sum + route.serious, 0);
  const maxCritical = journey.a11yThresholds?.maxCritical ?? 0;
  const maxSerious = journey.a11yThresholds?.maxSerious ?? 0;
  if (totalCritical > maxCritical) {
    violations.push(`${journey.id}: critical a11y violations ${totalCritical} > ${maxCritical}`);
  }
  if (totalSerious > maxSerious) {
    violations.push(`${journey.id}: serious a11y violations ${totalSerious} > ${maxSerious}`);
  }

  const sourceKeys = extractJourneyKeys(journey.sourceGlobs ?? []);
  const perLocale = [];

  for (const locale of policy.targetLocales ?? []) {
    const localeSet = localeKeys[locale] ?? new Set();
    const missingKeys = sourceKeys.filter((key) => !localeSet.has(key));
    const completeness = sourceKeys.length === 0
      ? 100
      : Number((((sourceKeys.length - missingKeys.length) / sourceKeys.length) * 100).toFixed(2));
    const minCompleteness = journey.l10nThresholds?.minCompletenessPercent ?? 100;

    if (completeness < minCompleteness) {
      violations.push(
        `${journey.id}: locale ${locale} completeness ${completeness}% < ${minCompleteness}% (missing ${missingKeys.length} keys)`
      );
    }

    perLocale.push({
      locale,
      sourceKeys: sourceKeys.length,
      missingKeys: missingKeys.length,
      completenessPercent: completeness,
      sampleMissingKeys: missingKeys.slice(0, 15),
    });
  }

  journeys.push({
    id: journey.id,
    name: journey.name,
    routeMetrics,
    totals: {
      critical: totalCritical,
      serious: totalSerious,
    },
    localization: perLocale,
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  policyPath,
  reportPath,
  journeys,
  pass: violations.length === 0,
  violations,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf-8");

if (violations.length > 0) {
  console.error("❌ Top-tier journey UX gate failed");
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log("✅ Top-tier journey UX gate passed");
