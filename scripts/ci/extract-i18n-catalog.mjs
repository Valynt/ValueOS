#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const sourcePath = resolve(
  ROOT,
  "apps/ValyntApp/src/i18n/locales/en/common.json"
);
const outputPath = resolve(
  ROOT,
  getArgValue(process.argv.slice(2), "--out") ??
    "artifacts/i18n/extracted-keys.json"
);

function getArgValue(args, key) {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : undefined;
}

const source = JSON.parse(readFileSync(sourcePath, "utf-8"));
const catalog = {
  generatedAt: new Date().toISOString(),
  sourceLocale: "en",
  sourcePath,
  keyCount: Object.keys(source).length,
  entries: Object.entries(source).map(([key, value]) => ({
    key,
    source: value,
  })),
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf-8");

console.log(`✅ Extracted ${catalog.keyCount} i18n keys to ${outputPath}`);
