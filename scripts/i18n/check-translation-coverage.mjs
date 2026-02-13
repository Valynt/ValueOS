#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const defaultLocale = process.env.I18N_DEFAULT_LOCALE ?? 'en';
const localesDir = process.env.I18N_LOCALES_DIR ?? 'apps/ValyntApp/src/i18n/locales';
const fallbackThreshold = Number(process.env.I18N_FALLBACK_RATIO_THRESHOLD ?? '0.05');

if (Number.isNaN(fallbackThreshold) || fallbackThreshold < 0 || fallbackThreshold > 1) {
  console.error('I18N_FALLBACK_RATIO_THRESHOLD must be a decimal between 0 and 1.');
  process.exit(1);
}

function flattenKeys(input, prefix = '') {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return Object.entries(input).flatMap(([k, v]) => flattenKeys(v, prefix ? `${prefix}.${k}` : k));
  }

  return prefix ? [prefix] : [];
}

async function loadLocaleNamespaces(localePath) {
  const entries = await readdir(localePath, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));

  const namespaceMaps = new Map();

  for (const file of files) {
    const filePath = path.join(localePath, file.name);
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    namespaceMaps.set(file.name, new Set(flattenKeys(parsed)));
  }

  return namespaceMaps;
}

async function main() {
  const localeEntries = await readdir(localesDir, { withFileTypes: true });
  const localeDirs = localeEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  if (!localeDirs.includes(defaultLocale)) {
    console.error(`Default locale "${defaultLocale}" was not found in ${localesDir}.`);
    process.exit(1);
  }

  const localeNamespaces = new Map();
  for (const locale of localeDirs) {
    localeNamespaces.set(locale, await loadLocaleNamespaces(path.join(localesDir, locale)));
  }

  const defaultNamespaces = localeNamespaces.get(defaultLocale);
  const defaultNamespaceFiles = [...defaultNamespaces.keys()];
  const errors = [];

  console.log(`Checking locale coverage in ${localesDir}`);
  console.log(`Default locale: ${defaultLocale}`);
  console.log(`Fallback ratio threshold: ${(fallbackThreshold * 100).toFixed(2)}%`);

  for (const locale of localeDirs) {
    if (locale === defaultLocale) continue;

    const namespaces = localeNamespaces.get(locale);
    let missingCount = 0;
    let baseCount = 0;

    for (const namespaceFile of defaultNamespaceFiles) {
      const baseKeys = defaultNamespaces.get(namespaceFile) ?? new Set();
      const targetKeys = namespaces.get(namespaceFile) ?? new Set();
      const missingKeys = [...baseKeys].filter((key) => !targetKeys.has(key));
      const unusedKeys = [...targetKeys].filter((key) => !baseKeys.has(key));

      baseCount += baseKeys.size;
      missingCount += missingKeys.length;

      if (missingKeys.length > 0) {
        errors.push(`[${locale}/${namespaceFile}] Missing keys (${missingKeys.length}): ${missingKeys.join(', ')}`);
      }

      if (unusedKeys.length > 0) {
        errors.push(`[${locale}/${namespaceFile}] Unused keys (${unusedKeys.length}): ${unusedKeys.join(', ')}`);
      }
    }

    const extraNamespaceFiles = [...namespaces.keys()].filter((namespaceFile) => !defaultNamespaces.has(namespaceFile));
    if (extraNamespaceFiles.length > 0) {
      errors.push(`[${locale}] Unused namespace files: ${extraNamespaceFiles.join(', ')}`);
    }

    const fallbackRatio = baseCount === 0 ? 0 : missingCount / baseCount;
    console.log(`Locale ${locale}: ${missingCount}/${baseCount} missing keys (${(fallbackRatio * 100).toFixed(2)}%)`);

    if (fallbackRatio > fallbackThreshold) {
      errors.push(
        `[${locale}] Fallback ratio ${(fallbackRatio * 100).toFixed(2)}% exceeds threshold ${(fallbackThreshold * 100).toFixed(2)}%`,
      );
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Localization coverage check failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('\n✅ Localization coverage check passed.');
}

main().catch((error) => {
  console.error('Localization coverage check crashed.');
  console.error(error);
  process.exit(1);
});
