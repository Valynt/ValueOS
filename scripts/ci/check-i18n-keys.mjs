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

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";

const ROOT = resolve(import.meta.dirname, "../..");
const I18N_DIRS = ["apps/ValyntApp/src/i18n/locales"];
const SOURCE_LOCALE = "en";
const MIN_COVERAGE_PERCENT = 90;
const SRC_DIRS = ["apps/ValyntApp/src", "apps/VOSAcademy/src"];

let hasErrors = false;
let hasWarnings = false;

function loadLocaleKeys(localeDir) {
  const keys = new Set();
  if (!existsSync(localeDir)) return keys;

  for (const file of readdirSync(localeDir).filter((f) => f.endsWith(".json"))) {
    try {
      const content = JSON.parse(readFileSync(join(localeDir, file), "utf-8"));
      for (const key of Object.keys(content)) {
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
  // Match patterns like t("key"), t('key'), i18n.t("key")
  const pattern = `(?:t|i18n\\.t)\\(["']([a-zA-Z0-9_.]+)["']`;

  for (const dir of srcDirs) {
    const absDir = join(ROOT, dir);
    if (!existsSync(absDir)) continue;

    try {
      const result = execSync(
        `grep -rEoh '${pattern}' "${absDir}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true`,
        { encoding: "utf-8" }
      );

      for (const line of result.split("\n")) {
        const match = line.match(/["']([a-zA-Z0-9_.]+)["']/);
        if (match) used.add(match[1]);
      }
    } catch {
      // grep returns non-zero if no matches
    }
  }
  return used;
}

console.log("🌐 Checking i18n translation keys...\n");

for (const i18nRelDir of I18N_DIRS) {
  const i18nDir = join(ROOT, i18nRelDir);
  if (!existsSync(i18nDir)) {
    console.log(`  ⚠️  i18n directory not found: ${i18nRelDir}`);
    continue;
  }

  const locales = readdirSync(i18nDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (!locales.includes(SOURCE_LOCALE)) {
    console.error(`  ❌ Source locale "${SOURCE_LOCALE}" not found in ${i18nRelDir}`);
    hasErrors = true;
    continue;
  }

  const sourceKeys = loadLocaleKeys(join(i18nDir, SOURCE_LOCALE));
  console.log(`  Source locale (${SOURCE_LOCALE}): ${sourceKeys.size} keys`);

  // Check each non-source locale
  for (const locale of locales) {
    if (locale === SOURCE_LOCALE) continue;

    const localeKeys = loadLocaleKeys(join(i18nDir, locale));
    const missing = [...sourceKeys].filter((k) => !localeKeys.has(k));
    const extra = [...localeKeys].filter((k) => !sourceKeys.has(k));
    const coverage = sourceKeys.size > 0
      ? Math.round((localeKeys.size - extra.length) / sourceKeys.size * 100)
      : 100;

    console.log(`  Locale "${locale}": ${localeKeys.size} keys, coverage ${coverage}%`);

    if (missing.length > 0) {
      console.error(`    ❌ Missing ${missing.length} keys: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "..." : ""}`);
      hasErrors = true;
    }

    if (extra.length > 0) {
      console.warn(`    ⚠️  Extra ${extra.length} keys not in source: ${extra.slice(0, 10).join(", ")}${extra.length > 10 ? "..." : ""}`);
      hasWarnings = true;
    }

    if (coverage < MIN_COVERAGE_PERCENT) {
      console.error(`    ❌ Coverage ${coverage}% is below minimum ${MIN_COVERAGE_PERCENT}%`);
      hasErrors = true;
    }
  }
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
    } else {
      console.log("  ✅ No unused keys detected");
    }
  }
} else {
  console.log("  ⚠️  Could not detect used keys from source (grep found no matches)");
}

console.log("");

if (hasErrors) {
  console.error("❌ i18n key check failed");
  process.exit(1);
} else if (hasWarnings) {
  console.log("⚠️  i18n key check passed with warnings");
} else {
  console.log("✅ i18n key check passed");
}
