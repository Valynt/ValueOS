#!/usr/bin/env node

import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(import.meta.dirname, "../..");
const sourceFile = resolve(root, "apps/ValyntApp/src/i18n/locales/en/common.json");

const ACCENT_MAP = {
  a: "à", A: "À",
  e: "ë", E: "Ë",
  i: "ï", I: "Ï",
  o: "ô", O: "Ô",
  u: "ü", U: "Ü",
  y: "ÿ", Y: "Ÿ",
};

function pseudoLocalize(input) {
  const accented = input.replace(/[aAeEiIoOuUyY]/g, (ch) => ACCENT_MAP[ch] ?? ch);
  const wrapped = `⟪${accented}⟫`;

  const targetLength = Math.ceil(input.length * 1.3);
  const paddingNeeded = Math.max(0, targetLength - wrapped.length);

  return `${wrapped}${"~".repeat(paddingNeeded)}`;
}

function isPlaceholderOnly(str) {
  return /^\s*(\{\{[^}]+\}\}|\{[^}]+\}|%s|%d|\$\{[^}]+\})\s*$/.test(str);
}

function flattenEntries(obj, prefix = "") {
  const rows = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      rows.push(...flattenEntries(value, path));
      continue;
    }

    if (typeof value === "string") {
      rows.push([path, value]);
    }
  }
  return rows;
}

const source = JSON.parse(readFileSync(sourceFile, "utf-8"));
const entries = flattenEntries(source);

if (entries.length === 0) {
  console.error("❌ No source i18n entries found for pseudo-localization checks.");
  process.exit(1);
}

let failures = 0;
let totalRatio = 0;
let ratioCount = 0;

for (const [key, value] of entries) {
  if (!value.trim()) {
    console.error(`❌ Empty source translation for key: ${key}`);
    failures += 1;
    continue;
  }

  if (isPlaceholderOnly(value)) {
    continue;
  }

  const pseudo = pseudoLocalize(value);
  if (!pseudo || pseudo === value) {
    console.error(`❌ Pseudo-localization did not transform key: ${key}`);
    failures += 1;
    continue;
  }

  const ratio = pseudo.length / value.length;
  totalRatio += ratio;
  ratioCount += 1;

  const lowerBound = value.length >= 12 ? 1.15 : 1.0;
  const upperBound = value.length >= 12 ? 1.6 : 4.5;

  if (ratio < lowerBound || ratio > upperBound) {
    console.error(
      `❌ Expansion ratio out of bounds for ${key}: ${ratio.toFixed(2)} (expected ${lowerBound.toFixed(2)}-${upperBound.toFixed(2)})`
    );
    failures += 1;
  }
}

if (ratioCount === 0) {
  console.error("❌ No non-placeholder entries were validated.");
  process.exit(1);
}

const avgRatio = totalRatio / ratioCount;
console.log(`✅ Pseudo-localization check validated ${ratioCount} keys.`);
console.log(`ℹ️  Average expansion ratio: ${avgRatio.toFixed(2)}x`);

if (failures > 0) {
  console.error(`❌ Pseudo-localization check failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log("✅ Pseudo-localization guardrails passed.");
