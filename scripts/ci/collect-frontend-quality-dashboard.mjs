#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const dashboardPath = resolve(
  ROOT,
  arg("--dashboard-out", "artifacts/frontend-quality/dashboard.md")
);
const jsonPath = resolve(
  ROOT,
  arg("--json-out", "artifacts/frontend-quality/dashboard.json")
);
const distDir = resolve(ROOT, arg("--dist", "apps/ValyntApp/dist"));

const paths = {
  a11yTrend: resolve(
    ROOT,
    arg("--a11y-trend", "artifacts/accessibility/a11y-metrics.json")
  ),
  wcagSeverity: resolve(
    ROOT,
    arg("--wcag-severity", "artifacts/accessibility/wcag-severity-metrics.json")
  ),
  playwright: resolve(
    ROOT,
    arg("--playwright", "artifacts/accessibility/playwright-report.json")
  ),
  i18nCoverage: resolve(
    ROOT,
    arg("--i18n-coverage", "artifacts/i18n/coverage-dashboard.json")
  ),
  pseudoLoc: resolve(
    ROOT,
    arg("--pseudo-loc", "artifacts/i18n/pseudo-localization-report.json")
  ),
};

function readJsonMaybe(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : null;
}

function toMB(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(2));
}

function parseRouteLoadMetrics(playwrightReport) {
  const routeLoads = [];

  function walkSuite(suite) {
    for (const spec of suite.specs ?? []) {
      for (const testCase of spec.tests ?? []) {
        for (const annotation of testCase.annotations ?? []) {
          if (annotation.type !== "route-load") continue;
          try {
            routeLoads.push(JSON.parse(annotation.description));
          } catch {
            // ignore malformed annotations
          }
        }
      }
    }

    for (const child of suite.suites ?? []) {
      walkSuite(child);
    }
  }

  for (const suite of playwrightReport?.suites ?? []) {
    walkSuite(suite);
  }

  const valid = routeLoads.filter(
    x => typeof x.domContentLoadedMs === "number"
  );
  valid.sort((a, b) => a.domContentLoadedMs - b.domContentLoadedMs);
  const p95Index =
    valid.length === 0 ? -1 : Math.max(0, Math.ceil(valid.length * 0.95) - 1);

  return {
    sampledRoutes: routeLoads.length,
    routes: routeLoads,
    domContentLoadedP95Ms:
      p95Index >= 0 ? valid[p95Index].domContentLoadedMs : null,
  };
}

const a11yTrend = readJsonMaybe(paths.a11yTrend);
const wcagSeverity = readJsonMaybe(paths.wcagSeverity);
const playwrightReport = readJsonMaybe(paths.playwright);
const i18nCoverage = readJsonMaybe(paths.i18nCoverage);
const pseudoLoc = readJsonMaybe(paths.pseudoLoc);

const routeLoad = parseRouteLoadMetrics(playwrightReport);
function getDirectorySizeBytes(dir) {
  if (!existsSync(dir)) return null;
  let total = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else total += statSync(fullPath).size;
    }
  }
  return total;
}

const bundleSizeBytes = getDirectorySizeBytes(distDir);

const dashboard = {
  generatedAt: new Date().toISOString(),
  accessibility: {
    passRate: a11yTrend?.passRate ?? null,
    keyboardCoverage: a11yTrend?.keyboardCoverage ?? null,
    severityCounts: wcagSeverity?.severityCounts ?? null,
  },
  localization: {
    localesChecked: i18nCoverage?.totals?.localesChecked ?? null,
    localesBelowThreshold: i18nCoverage?.totals?.localesBelowThreshold ?? null,
    pseudoStatus: pseudoLoc?.status ?? null,
    pseudoTokenIntegrityFailures:
      pseudoLoc?.totals?.tokenIntegrityFailures ?? null,
  },
  performance: {
    bundleIndexAndDirSizeBytes: bundleSizeBytes,
    bundleIndexAndDirSizeMB:
      bundleSizeBytes !== null ? toMB(bundleSizeBytes) : null,
    routeLoad,
  },
  artifactRefs: paths,
};

const markdown =
  `# Frontend Quality Dashboard\n\n` +
  `Generated: ${dashboard.generatedAt}\n\n` +
  `## Accessibility\n` +
  `- pass rate: ${dashboard.accessibility.passRate ?? "n/a"}%\n` +
  `- keyboard coverage: ${dashboard.accessibility.keyboardCoverage ?? "n/a"}%\n` +
  `- WCAG severities: ${dashboard.accessibility.severityCounts ? JSON.stringify(dashboard.accessibility.severityCounts) : "n/a"}\n\n` +
  `## Localization\n` +
  `- locales checked: ${dashboard.localization.localesChecked ?? "n/a"}\n` +
  `- locales below threshold: ${dashboard.localization.localesBelowThreshold ?? "n/a"}\n` +
  `- pseudo-localization status: ${dashboard.localization.pseudoStatus ?? "n/a"}\n` +
  `- pseudo token integrity failures: ${dashboard.localization.pseudoTokenIntegrityFailures ?? "n/a"}\n\n` +
  `## Performance KPIs\n` +
  `- bundle footprint (index.html + dist dir metadata): ${dashboard.performance.bundleIndexAndDirSizeMB ?? "n/a"} MB\n` +
  `- sampled route loads: ${dashboard.performance.routeLoad.sampledRoutes}\n` +
  `- route DOMContentLoaded p95: ${dashboard.performance.routeLoad.domContentLoadedP95Ms ?? "n/a"} ms\n`;

mkdirSync(dirname(dashboardPath), { recursive: true });
mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(dashboardPath, markdown, "utf-8");
writeFileSync(jsonPath, `${JSON.stringify(dashboard, null, 2)}\n`, "utf-8");

console.log(`✅ Frontend quality dashboard written to ${dashboardPath}`);
