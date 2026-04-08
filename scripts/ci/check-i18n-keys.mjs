#!/usr/bin/env node

/**
 * CI check for i18n translation key integrity.
 *
 * Checks:
 * 1. Missing keys — non-source locales missing keys from the source locale.
 * 2. Unused keys — keys in locale files not referenced in source code.
 * 3. Fallback ratio — locales below the minimum translation coverage threshold.
 *
 * Exit code 1 on failure.
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { execSync } from "child_process";

const ROOT = resolve(import.meta.dirname, "../..");
const I18N_DIRS = ["apps/ValyntApp/src/i18n/locales"];
const SOURCE_LOCALE = "en";
const I18N_CONFIG_PATH = "apps/ValyntApp/src/i18n/index.ts";
const DEFAULT_MIN_COVERAGE_PERCENT = 90;
const DEFAULT_MIN_KEY_COMPLETENESS_PERCENT = 100;
const DEFAULT_NEWLY_DECLARED_LOCALE_MIN_COVERAGE_PERCENT = 100;
const DEFAULT_NEWLY_DECLARED_LOCALE_MIN_KEY_COMPLETENESS_PERCENT = 100;
const SRC_DIRS = ["apps/ValyntApp/src", "apps/VOSAcademy/src"];

const cliArgs = process.argv.slice(2);
const jsonOutPath = getArgValue(cliArgs, "--json-out");
const minCoverageArg = getArgValue(cliArgs, "--min-coverage");
const minCompletenessArg = getArgValue(cliArgs, "--min-completeness");
const minNewLocaleCoverageArg = getArgValue(cliArgs, "--min-new-locale-coverage");
const minNewLocaleCompletenessArg = getArgValue(cliArgs, "--min-new-locale-completeness");

const parsedMinCoverage = Number.parseInt(
  minCoverageArg ?? process.env.I18N_MIN_COVERAGE_PERCENT ?? `${DEFAULT_MIN_COVERAGE_PERCENT}`,
  10
);
const MIN_COVERAGE_PERCENT = Number.isNaN(parsedMinCoverage)
  ? DEFAULT_MIN_COVERAGE_PERCENT
  : parsedMinCoverage;

const parsedMinCompleteness = Number.parseInt(
  minCompletenessArg ?? process.env.I18N_MIN_KEY_COMPLETENESS_PERCENT ?? `${DEFAULT_MIN_KEY_COMPLETENESS_PERCENT}`,
  10
);
const MIN_KEY_COMPLETENESS_PERCENT = Number.isNaN(parsedMinCompleteness)
  ? DEFAULT_MIN_KEY_COMPLETENESS_PERCENT
  : parsedMinCompleteness;

const parsedMinNewLocaleCoverage = Number.parseInt(
  minNewLocaleCoverageArg ??
    process.env.I18N_NEW_LOCALE_MIN_COVERAGE_PERCENT ??
    `${DEFAULT_NEWLY_DECLARED_LOCALE_MIN_COVERAGE_PERCENT}`,
  10
);
const MIN_NEW_LOCALE_COVERAGE_PERCENT = Number.isNaN(parsedMinNewLocaleCoverage)
  ? DEFAULT_NEWLY_DECLARED_LOCALE_MIN_COVERAGE_PERCENT
  : parsedMinNewLocaleCoverage;

const parsedMinNewLocaleCompleteness = Number.parseInt(
  minNewLocaleCompletenessArg ??
    process.env.I18N_NEW_LOCALE_MIN_KEY_COMPLETENESS_PERCENT ??
    `${DEFAULT_NEWLY_DECLARED_LOCALE_MIN_KEY_COMPLETENESS_PERCENT}`,
  10
);
const MIN_NEW_LOCALE_KEY_COMPLETENESS_PERCENT = Number.isNaN(parsedMinNewLocaleCompleteness)
  ? DEFAULT_NEWLY_DECLARED_LOCALE_MIN_KEY_COMPLETENESS_PERCENT
  : parsedMinNewLocaleCompleteness;

let hasErrors = false;
let hasWarnings = false;
const dashboard = {
  sourceLocale: SOURCE_LOCALE,
  minimumCoveragePercent: MIN_COVERAGE_PERCENT,
  minimumKeyCompletenessPercent: MIN_KEY_COMPLETENESS_PERCENT,
  newlyDeclaredLocaleMinimumCoveragePercent: MIN_NEW_LOCALE_COVERAGE_PERCENT,
  newlyDeclaredLocaleMinimumKeyCompletenessPercent: MIN_NEW_LOCALE_KEY_COMPLETENESS_PERCENT,
  localeDirectories: [],
  totals: {
    localesChecked: 0,
    declaredLocales: 0,
    newlyDeclaredLocales: 0,
    newlyDeclaredLocalesWithMissingCoverage: 0,
    newlyDeclaredLocalesBelowCoverageThreshold: 0,
    newlyDeclaredLocalesBelowCompletenessThreshold: 0,
    missingKeys: 0,
    extraKeys: 0,
    localesBelowThreshold: 0,
    localesBelowCompletenessThreshold: 0,
    unusedKeys: 0,
  },
  status: "pass",
  generatedAt: new Date().toISOString(),
};

function getArgValue(args, key) {
  const idx = args.indexOf(key);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

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

function loadLocaleKeys(localeDir) {
  const keys = new Set();
  if (!existsSync(localeDir)) return keys;

  for (const file of readdirSync(localeDir).filter((f) => f.endsWith(".json"))) {
    try {
      const content = JSON.parse(readFileSync(join(localeDir, file), "utf-8"));
      for (const key of flattenTranslationKeys(content)) {
        keys.add(key);
      }
    } catch (e) {
      console.error(`  ❌ Failed to parse ${join(localeDir, file)}: ${e.message}`);
      hasErrors = true;
    }
  }
  return keys;
}

function findUsedKeys(srcDirs) {
  const used = new Set();
  const usagePattern = /(t|i18n\.t)\(["']([a-zA-Z0-9_.]+)["']/g;

  for (const dir of srcDirs) {
    const absDir = join(ROOT, dir);
    if (!existsSync(absDir)) continue;

    let files = "";
    try {
      files = execSync(
        `rg --files "${absDir}" -g "*.ts" -g "*.tsx" -g "*.js" -g "*.jsx"`,
        { encoding: "utf-8" }
      );
    } catch {
      continue;
    }

    for (const file of files.split("\n").filter(Boolean)) {
      const content = readFileSync(file, "utf-8");
      for (const match of content.matchAll(usagePattern)) {
        used.add(match[2]);
      }
    }
  }

  return used;
}

function readDeclaredLocales() {
  const declared = new Set();
  const configPath = join(ROOT, I18N_CONFIG_PATH);
  if (!existsSync(configPath)) {
    return declared;
  }

  const source = readFileSync(configPath, "utf-8");
  for (const match of source.matchAll(/^\s*([a-zA-Z-]+)\s*:\s*\(\)\s*=>/gm)) {
    declared.add(match[1]);
  }

  return declared;
}

function readNewlyDeclaredLocales() {
  const output = new Set();
  const baseRef =
    process.env.I18N_BASE_REF ??
    process.env.GITHUB_BASE_REF ??
    process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME ??
    "origin/main";

  try {
    const diff = execSync(`git diff --unified=0 ${baseRef}...HEAD -- "${I18N_CONFIG_PATH}"`, {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    for (const line of diff.split("\n")) {
      if (!line.startsWith("+") || line.startsWith("+++")) continue;
      const localeMatch = line.match(/^\+\s*([a-zA-Z-]+)\s*:\s*\(\)\s*=>/);
      if (localeMatch) {
        output.add(localeMatch[1]);
      }
    }
  } catch {
    // Best-effort only; when unavailable, continue without diff-aware enforcement.
  }

  return output;
}

console.log("🌐 Checking i18n translation keys...\n");
const declaredLocales = readDeclaredLocales();
const newlyDeclaredLocales = readNewlyDeclaredLocales();
dashboard.totals.declaredLocales = declaredLocales.size;
dashboard.totals.newlyDeclaredLocales = newlyDeclaredLocales.size;

for (const i18nRelDir of I18N_DIRS) {
  const i18nDir = join(ROOT, i18nRelDir);
  if (!existsSync(i18nDir)) {
    console.log(`  ⚠️  i18n directory not found: ${i18nRelDir}`);
    continue;
  }

  const locales = readdirSync(i18nDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (declaredLocales.size > 0) {
    const missingDeclaredDirectories = [...declaredLocales].filter((locale) => !locales.includes(locale));
    if (missingDeclaredDirectories.length > 0) {
      console.error(
        `  ❌ Declared locale directories missing under ${i18nRelDir}: ${missingDeclaredDirectories.join(", ")}`
      );
      hasErrors = true;
    }
  }

  if (!locales.includes(SOURCE_LOCALE)) {
    console.error(`  ❌ Source locale "${SOURCE_LOCALE}" not found in ${i18nRelDir}`);
    hasErrors = true;
    continue;
  }

  const sourceKeys = loadLocaleKeys(join(i18nDir, SOURCE_LOCALE));
  console.log(`  Source locale (${SOURCE_LOCALE}): ${sourceKeys.size} keys`);

  const dirSummary = {
    directory: i18nRelDir,
    sourceKeys: sourceKeys.size,
    locales: [],
  };

  // Check each non-source locale
  for (const locale of locales) {
    if (locale === SOURCE_LOCALE) continue;

    const localeKeys = loadLocaleKeys(join(i18nDir, locale));
    const missing = [...sourceKeys].filter((k) => !localeKeys.has(k));
    const extra = [...localeKeys].filter((k) => !sourceKeys.has(k));
    const coverage = sourceKeys.size > 0
      ? Math.round(((localeKeys.size - extra.length) / sourceKeys.size) * 100)
      : 100;
    const keyCompleteness = sourceKeys.size > 0
      ? Number((((sourceKeys.size - missing.length) / sourceKeys.size) * 100).toFixed(2))
      : 100;

    dashboard.totals.localesChecked += 1;
    dashboard.totals.missingKeys += missing.length;
    dashboard.totals.extraKeys += extra.length;

    console.log(`  Locale "${locale}": ${localeKeys.size} keys, coverage ${coverage}%, completeness ${keyCompleteness}%`);

    if (missing.length > 0) {
      console.error(`    ❌ Missing ${missing.length} keys: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "..." : ""}`);
      hasErrors = true;
      if (newlyDeclaredLocales.has(locale)) {
        dashboard.totals.newlyDeclaredLocalesWithMissingCoverage += 1;
      }
    }

    if (newlyDeclaredLocales.has(locale)) {
      if (coverage < MIN_NEW_LOCALE_COVERAGE_PERCENT) {
        console.error(
          `    ❌ Newly declared locale "${locale}" coverage ${coverage}% is below required ${MIN_NEW_LOCALE_COVERAGE_PERCENT}%`
        );
        hasErrors = true;
        dashboard.totals.newlyDeclaredLocalesBelowCoverageThreshold += 1;
      }
      if (keyCompleteness < MIN_NEW_LOCALE_KEY_COMPLETENESS_PERCENT) {
        console.error(
          `    ❌ Newly declared locale "${locale}" key completeness ${keyCompleteness}% is below required ${MIN_NEW_LOCALE_KEY_COMPLETENESS_PERCENT}%`
        );
        hasErrors = true;
        dashboard.totals.newlyDeclaredLocalesBelowCompletenessThreshold += 1;
      }
    }

    if (extra.length > 0) {
      console.warn(`    ⚠️  Extra ${extra.length} keys not in source: ${extra.slice(0, 10).join(", ")}${extra.length > 10 ? "..." : ""}`);
      hasWarnings = true;
    }

    if (coverage < MIN_COVERAGE_PERCENT) {
      console.error(`    ❌ Coverage ${coverage}% is below minimum ${MIN_COVERAGE_PERCENT}%`);
      hasErrors = true;
      dashboard.totals.localesBelowThreshold += 1;
    }

    if (keyCompleteness < MIN_KEY_COMPLETENESS_PERCENT) {
      console.error(`    ❌ Key completeness ${keyCompleteness}% is below minimum ${MIN_KEY_COMPLETENESS_PERCENT}%`);
      hasErrors = true;
      dashboard.totals.localesBelowCompletenessThreshold += 1;
    }

    dirSummary.locales.push({
      locale,
      declaredInRuntime: declaredLocales.has(locale),
      newlyDeclaredInBranch: newlyDeclaredLocales.has(locale),
      keyCount: localeKeys.size,
      missingKeys: missing.length,
      extraKeys: extra.length,
      coverage,
      keyCompleteness,
      newlyDeclaredCoverageThreshold: newlyDeclaredLocales.has(locale)
        ? MIN_NEW_LOCALE_COVERAGE_PERCENT
        : null,
      newlyDeclaredKeyCompletenessThreshold: newlyDeclaredLocales.has(locale)
        ? MIN_NEW_LOCALE_KEY_COMPLETENESS_PERCENT
        : null,
      belowThreshold: coverage < MIN_COVERAGE_PERCENT,
      belowCompletenessThreshold: keyCompleteness < MIN_KEY_COMPLETENESS_PERCENT,
      belowNewlyDeclaredCoverageThreshold:
        newlyDeclaredLocales.has(locale) && coverage < MIN_NEW_LOCALE_COVERAGE_PERCENT,
      belowNewlyDeclaredCompletenessThreshold:
        newlyDeclaredLocales.has(locale) &&
        keyCompleteness < MIN_NEW_LOCALE_KEY_COMPLETENESS_PERCENT,
    });
  }

  for (const locale of newlyDeclaredLocales) {
    if (!locales.includes(locale)) {
      console.error(`    ❌ Newly declared locale "${locale}" is missing locale files under ${i18nRelDir}`);
      hasErrors = true;
      dashboard.totals.newlyDeclaredLocalesWithMissingCoverage += 1;
    }
  }

  dashboard.localeDirectories.push(dirSummary);
}

// Check for unused keys
console.log("\n  Checking for unused translation keys...");
const usedKeys = findUsedKeys(SRC_DIRS);

if (usedKeys.size > 0) {
  for (const i18nRelDir of I18N_DIRS) {
    const sourceKeys = loadLocaleKeys(join(ROOT, i18nRelDir, SOURCE_LOCALE));
    const unused = [...sourceKeys].filter((k) => !usedKeys.has(k));

    if (unused.length > 0) {
      console.warn(`  ⚠️  ${unused.length} potentially unused keys: ${unused.slice(0, 10).join(", ")}${unused.length > 10 ? "..." : ""}`);
      hasWarnings = true;
      dashboard.totals.unusedKeys += unused.length;
    } else {
      console.log("  ✅ No unused keys detected");
    }
  }
} else {
  console.log("  ⚠️  Could not detect used keys from source (source scan found no matches)");
}

console.log("");

if (hasErrors) {
  console.error("❌ i18n key check failed");
  dashboard.status = "fail";
  writeDashboard(jsonOutPath, dashboard);
  process.exit(1);
} else if (hasWarnings) {
  console.log("⚠️  i18n key check passed with warnings");
  dashboard.status = "warn";
} else {
  console.log("✅ i18n key check passed");
  dashboard.status = "pass";
}

writeDashboard(jsonOutPath, dashboard);

function writeDashboard(path, data) {
  if (!path) return;
  const absolutePath = resolve(ROOT, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}
