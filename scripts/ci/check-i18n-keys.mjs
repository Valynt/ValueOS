#!/usr/bin/env node

/**
 * CI check for i18n translation key integrity and readiness metrics.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { execFileSync } from "child_process";

const ROOT = resolve(import.meta.dirname, "../..");
const BUDGET_FILE = join(ROOT, "config/readiness-budgets.json");
const I18N_DIRS = ["apps/ValyntApp/src/i18n/locales"];
const SRC_DIRS = ["apps/ValyntApp/src", "apps/VOSAcademy/src"];
const METRICS_FILE = join(ROOT, "artifacts/ci/i18n-readiness-metrics.json");

const defaults = {
  sourceLocale: "en",
  minimumCoveragePercent: 90,
  requireLocaleKeyCompleteness: true,
};

const i18nBudget = existsSync(BUDGET_FILE)
  ? { ...defaults, ...JSON.parse(readFileSync(BUDGET_FILE, "utf-8")).i18n }
  : defaults;

let hasErrors = false;
let hasWarnings = false;
const report = {
  generatedAt: new Date().toISOString(),
  sourceLocale: i18nBudget.sourceLocale,
  minimumCoveragePercent: i18nBudget.minimumCoveragePercent,
  locales: {},
  totals: { missingKeys: 0, extraKeys: 0, localesFailed: 0, unusedKeys: 0 },
};

function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj || {})) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, next));
    } else {
      keys.push(next);
    }
  }
  return keys;
}

function loadLocaleKeys(localeDir) {
  const keys = new Set();
  if (!existsSync(localeDir)) return keys;

  for (const file of readdirSync(localeDir).filter((f) => f.endsWith(".json"))) {
    try {
      const content = JSON.parse(readFileSync(join(localeDir, file), "utf-8"));
      for (const key of flattenKeys(content)) {
        keys.add(`${file}:${key}`);
      }
    } catch (e) {
      console.error(`  ❌ Failed to parse ${join(localeDir, file)}: ${e.message}`);
      hasErrors = true;
    }
  }
  return keys;
}

function normalizeKey(k) {
  const split = k.indexOf(":");
  return split === -1 ? k : k.slice(split + 1);
}

function findUsedKeys(srcDirs) {
  const used = new Set();
  const pattern = String.raw`(?:t|i18n\.t)\(["']([a-zA-Z0-9_.]+)["']`;

  for (const dir of srcDirs) {
    const absDir = join(ROOT, dir);
    if (!existsSync(absDir)) continue;

    try {
      const result = execFileSync(
        "rg",
        ["-o", "--no-filename", "-g", "*.ts", "-g", "*.tsx", "-g", "*.js", "-g", "*.jsx", "-P", pattern, absDir],
        { encoding: "utf-8" }
      );

      for (const line of result.split("\n")) {
        const match = line.match(/["']([a-zA-Z0-9_.]+)["']/);
        if (match) used.add(match[1]);
      }
    } catch {
      // no matches
    }
  }
  return used;
}


console.log("🌐 Checking i18n translation keys and locale completeness...\n");

for (const i18nRelDir of I18N_DIRS) {
  const i18nDir = join(ROOT, i18nRelDir);
  if (!existsSync(i18nDir)) {
    console.log(`  ⚠️  i18n directory not found: ${i18nRelDir}`);
    continue;
  }

  const locales = readdirSync(i18nDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const sourceLocale = i18nBudget.sourceLocale;
  if (!locales.includes(sourceLocale)) {
    console.error(`  ❌ Source locale "${sourceLocale}" not found in ${i18nRelDir}`);
    hasErrors = true;
    continue;
  }

  const sourceKeys = loadLocaleKeys(join(i18nDir, sourceLocale));
  console.log(`  Source locale (${sourceLocale}): ${sourceKeys.size} keys`);

  for (const locale of locales) {
    if (locale === sourceLocale) continue;

    const localeKeys = loadLocaleKeys(join(i18nDir, locale));
    const missing = [...sourceKeys].filter((k) => !localeKeys.has(k));
    const extra = [...localeKeys].filter((k) => !sourceKeys.has(k));
    const coverage = sourceKeys.size > 0
      ? Math.round(((localeKeys.size - extra.length) / sourceKeys.size) * 100)
      : 100;

    report.locales[locale] = {
      keyCount: localeKeys.size,
      sourceKeyCount: sourceKeys.size,
      missingKeys: missing.length,
      extraKeys: extra.length,
      coveragePercent: coverage,
      passed: true,
    };

    console.log(`  Locale "${locale}": ${localeKeys.size} keys, coverage ${coverage}%`);

    if (i18nBudget.requireLocaleKeyCompleteness && missing.length > 0) {
      console.error(`    ❌ Missing ${missing.length} keys: ${missing.slice(0, 10).map(normalizeKey).join(", ")}${missing.length > 10 ? "..." : ""}`);
      hasErrors = true;
      report.locales[locale].passed = false;
    }

    if (extra.length > 0) {
      console.warn(`    ⚠️  Extra ${extra.length} keys not in source: ${extra.slice(0, 10).map(normalizeKey).join(", ")}${extra.length > 10 ? "..." : ""}`);
      hasWarnings = true;
    }

    if (coverage < i18nBudget.minimumCoveragePercent) {
      console.error(`    ❌ Coverage ${coverage}% is below minimum ${i18nBudget.minimumCoveragePercent}%`);
      hasErrors = true;
      report.locales[locale].passed = false;
    }

    report.totals.missingKeys += missing.length;
    report.totals.extraKeys += extra.length;
    if (!report.locales[locale].passed) report.totals.localesFailed += 1;
  }
}

console.log("\n  Checking for unused translation keys...");
const usedKeys = findUsedKeys(SRC_DIRS);

if (usedKeys.size > 0) {
  for (const i18nRelDir of I18N_DIRS) {
    const sourceKeys = loadLocaleKeys(join(ROOT, i18nRelDir, i18nBudget.sourceLocale));
    const unused = [...sourceKeys]
      .map((k) => normalizeKey(k))
      .filter((k) => !usedKeys.has(k));

    if (unused.length > 0) {
      console.warn(`  ⚠️  ${unused.length} potentially unused keys: ${unused.slice(0, 10).join(", ")}${unused.length > 10 ? "..." : ""}`);
      hasWarnings = true;
      report.totals.unusedKeys += unused.length;
    } else {
      console.log("  ✅ No unused keys detected");
    }
  }
} else {
  console.log("  ⚠️  Could not detect used keys from source (grep found no matches)");
}

mkdirSync(join(ROOT, "artifacts/ci"), { recursive: true });
writeFileSync(METRICS_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
console.log(`\n📊 Wrote i18n readiness metrics to ${METRICS_FILE}`);

if (hasErrors) {
  console.error("❌ i18n key check failed");
  process.exit(1);
}

if (hasWarnings) {
  console.log("⚠️  i18n key check passed with warnings");
} else {
  console.log("✅ i18n key check passed");
}
