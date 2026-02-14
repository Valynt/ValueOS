#!/usr/bin/env node

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const SOURCE_LOCALE = "en";
const LOCALES_ROOT = join(ROOT, "apps/ValyntApp/src/i18n/locales");
const REPORT_PATH = resolve(
  ROOT,
  getArgValue(process.argv.slice(2), "--json-out") ?? "artifacts/i18n/pseudo-localization-report.json"
);
const MIN_EXPANSION_RATIO = Number.parseFloat(
  getArgValue(process.argv.slice(2), "--min-expansion") ?? process.env.PSEUDO_LOC_MIN_EXPANSION ?? "1.3"
);

const ACCENT_MAP = {
  a: "à", b: "ƀ", c: "ç", d: "đ", e: "ë", f: "ƒ", g: "ğ", h: "ħ", i: "ï", j: "ĵ", k: "ķ", l: "ľ",
  m: "m", n: "ñ", o: "ô", p: "þ", q: "q", r: "ř", s: "ş", t: "ŧ", u: "ü", v: "ṽ", w: "ŵ", x: "ẋ", y: "ÿ", z: "ž",
  A: "Â", B: "ß", C: "Č", D: "Ď", E: "Ë", F: "Ƒ", G: "Ğ", H: "Ħ", I: "Ï", J: "Ĵ", K: "Ķ", L: "Ľ",
  M: "M", N: "Ń", O: "Ö", P: "Þ", Q: "Q", R: "Ř", S: "Š", T: "Ŧ", U: "Û", V: "Ṽ", W: "Ŵ", X: "Ẍ", Y: "Ŷ", Z: "Ž",
};

let hasErrors = false;

function getArgValue(args, key) {
  const idx = args.indexOf(key);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function pseudoLocalize(input) {
  const tokenPattern = /(\{\{[^}]+\}\}|\{[^}]+\}|%\{[^}]+\}|%s|%d)/g;
  const tokenSegmentPattern = /^(\{\{[^}]+\}\}|\{[^}]+\}|%\{[^}]+\}|%s|%d)$/;
  const segments = input.split(tokenPattern);
  return segments
    .map((segment) => {
      if (!segment) return segment;
      if (tokenSegmentPattern.test(segment)) return segment;
      const accented = [...segment].map((ch) => ACCENT_MAP[ch] ?? ch).join("");
      const padLength = Math.max(2, Math.ceil(accented.length * 0.35));
      return `${accented}${"~".repeat(padLength)}`;
    })
    .join("");
}

function extractTokens(value) {
  return (value.match(/(\{\{[^}]+\}\}|\{[^}]+\}|%\{[^}]+\}|%s|%d)/g) ?? []).sort();
}

if (!existsSync(LOCALES_ROOT) || !existsSync(join(LOCALES_ROOT, SOURCE_LOCALE))) {
  console.error("❌ Source locale directory not found for pseudo-localization check");
  process.exit(1);
}

const sourceFiles = readdirSync(join(LOCALES_ROOT, SOURCE_LOCALE)).filter((f) => f.endsWith(".json"));
const report = {
  minimumExpansionRatio: MIN_EXPANSION_RATIO,
  generatedAt: new Date().toISOString(),
  files: [],
  totals: {
    stringsChecked: 0,
    belowExpansionThreshold: 0,
    tokenIntegrityFailures: 0,
  },
  status: "pass",
};

console.log("🧪 Checking pseudo-localization readiness...\n");

for (const file of sourceFiles) {
  const sourcePath = join(LOCALES_ROOT, SOURCE_LOCALE, file);
  const source = JSON.parse(readFileSync(sourcePath, "utf-8"));

  const fileSummary = { file, keys: [], failures: 0 };

  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string" || value.trim().length === 0) continue;

    const pseudo = pseudoLocalize(value);
    const sourceTokens = extractTokens(value);
    const pseudoTokens = extractTokens(pseudo);
    const expansionRatio = value.length === 0 ? 1 : Number((pseudo.length / value.length).toFixed(2));
    const tokenIntegrity = JSON.stringify(sourceTokens) === JSON.stringify(pseudoTokens);

    report.totals.stringsChecked += 1;

    const belowExpansionThreshold = expansionRatio < MIN_EXPANSION_RATIO;
    if (belowExpansionThreshold) {
      report.totals.belowExpansionThreshold += 1;
      fileSummary.failures += 1;
      hasErrors = true;
    }

    if (!tokenIntegrity) {
      report.totals.tokenIntegrityFailures += 1;
      fileSummary.failures += 1;
      hasErrors = true;
    }

    fileSummary.keys.push({ key, expansionRatio, tokenIntegrity, belowExpansionThreshold });
  }

  report.files.push(fileSummary);
}

if (hasErrors) {
  report.status = "fail";
}

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

if (hasErrors) {
  console.error("❌ Pseudo-localization check failed");
  console.error(`  - Strings below expansion threshold: ${report.totals.belowExpansionThreshold}`);
  console.error(`  - Token integrity failures: ${report.totals.tokenIntegrityFailures}`);
  process.exit(1);
}

console.log(`✅ Pseudo-localization check passed (${report.totals.stringsChecked} strings)`);
console.log(`📦 Report written to ${REPORT_PATH}`);
