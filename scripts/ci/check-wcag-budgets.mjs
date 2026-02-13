#!/usr/bin/env node

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const budgetPath = join(ROOT, "config/readiness-budgets.json");
const baseUrl = process.env.WCAG_BASE_URL || "http://127.0.0.1:4173";
const outputPath = join(ROOT, "artifacts/ci/accessibility-readiness-metrics.json");

if (!existsSync(budgetPath)) {
  console.error(`❌ Missing budget config: ${budgetPath}`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(budgetPath, "utf-8"));
const wcag = config.accessibility?.wcag ?? {};
const severityBudget = {
  critical: 0,
  serious: 0,
  moderate: 9999,
  minor: 9999,
  ...(wcag.severityBudget ?? {}),
};
const routes = Array.isArray(wcag.routes) ? wcag.routes : ["/"];

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  budgets: severityBudget,
  routes: {},
  totals: { critical: 0, serious: 0, moderate: 0, minor: 0, violations: 0 },
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const route of routes) {
  const url = `${baseUrl}${route}`;
  await page.goto(url, { waitUntil: "networkidle" });

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();

  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0, violations: results.violations.length };
  for (const violation of results.violations) {
    if (violation.impact && Object.hasOwn(counts, violation.impact)) {
      counts[violation.impact] += 1;
    }
  }

  summary.routes[route] = counts;
  summary.totals.critical += counts.critical;
  summary.totals.serious += counts.serious;
  summary.totals.moderate += counts.moderate;
  summary.totals.minor += counts.minor;
  summary.totals.violations += counts.violations;

  console.log(`Route ${route}: critical=${counts.critical}, serious=${counts.serious}, moderate=${counts.moderate}, minor=${counts.minor}`);
}

await browser.close();

mkdirSync(join(ROOT, "artifacts/ci"), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
console.log(`📊 Wrote accessibility readiness metrics to ${outputPath}`);

const exceeded = Object.entries(severityBudget)
  .filter(([impact, limit]) => (summary.totals[impact] ?? 0) > limit)
  .map(([impact, limit]) => `${impact}=${summary.totals[impact]} (budget ${limit})`);

if (exceeded.length > 0) {
  console.error(`❌ WCAG severity budgets exceeded: ${exceeded.join(", ")}`);
  process.exit(1);
}

console.log("✅ WCAG severity budgets satisfied");
