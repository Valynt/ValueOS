#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const REPORT_PATH = path.resolve(ROOT, "artifacts/eslint/production-profile.json");
const ALLOWLIST_PATH = path.resolve(ROOT, "scripts/ci/production-eslint-allowlist.json");
const ALLOWLIST_CAP_PATH = path.resolve(
  ROOT,
  "scripts/ci/production-eslint-allowlist.max.json"
);
const WARNING_BASELINE_PATH = path.resolve(
  ROOT,
  "scripts/ci/production-eslint-warning-baseline.json"
);
const WARNING_ARTIFACT_PATH = path.resolve(
  ROOT,
  "artifacts/eslint/production-warning-counts.json"
);

const TEST_PATH_PATTERN =
  /(?:^|\/)(?:__tests__|__mocks__)(?:\/|$)|\.(?:test|spec|integration\.test|integration\.spec|int\.test|int\.spec)\.[cm]?[jt]sx?$/;

const PRODUCTION_RULES = new Set([
  "@typescript-eslint/no-explicit-any",
  "jsx-a11y/anchor-is-valid",
  "jsx-a11y/aria-props",
  "jsx-a11y/aria-role",
  "jsx-a11y/click-events-have-key-events",
  "jsx-a11y/interactive-supports-focus",
  "jsx-a11y/no-noninteractive-element-interactions",
  "jsx-a11y/no-static-element-interactions",
  "jsx-a11y/role-has-required-aria-props",
  "security/detect-child-process",
  "security/detect-eval-with-expression",
  "security/detect-non-literal-regexp",
  "security/detect-object-injection",
  "no-eval",
  "no-implied-eval",
  "no-new-func",
  "react/no-danger",
]);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function toRepoPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function isProductionTarget(filePath) {
  const inScope =
    filePath.startsWith("apps/ValyntApp/src/") ||
    filePath.startsWith("packages/backend/src/");
  return inScope && !TEST_PATH_PATTERN.test(filePath);
}

function toAllowlistMap(entries) {
  return new Map(entries.map((entry) => [`${entry.path}::${entry.rule}`, Number(entry.count)]));
}

const report = readJson(REPORT_PATH);
const allowlist = readJson(ALLOWLIST_PATH);
const allowlistCap = readJson(ALLOWLIST_CAP_PATH);
const warningBaseline = readJson(WARNING_BASELINE_PATH);

const violations = new Map();
const warningCounts = {
  "apps/ValyntApp": 0,
  "packages/backend": 0,
};

for (const fileResult of report) {
  const filePath = toRepoPath(fileResult.filePath ?? "");
  if (!isProductionTarget(filePath)) {
    continue;
  }

  if (filePath.startsWith("apps/ValyntApp/src/")) {
    warningCounts["apps/ValyntApp"] += Number(fileResult.warningCount ?? 0);
  }
  if (filePath.startsWith("packages/backend/src/")) {
    warningCounts["packages/backend"] += Number(fileResult.warningCount ?? 0);
  }

  for (const message of fileResult.messages ?? []) {
    if (!PRODUCTION_RULES.has(message.ruleId)) {
      continue;
    }

    const key = `${filePath}::${message.ruleId}`;
    violations.set(key, (violations.get(key) ?? 0) + 1);
  }
}

const allowlistMap = toAllowlistMap(allowlist.entries ?? []);
const allowlistCapMap = toAllowlistMap(allowlistCap.entries ?? []);

let hasFailure = false;

for (const [key, count] of violations.entries()) {
  const allowed = allowlistMap.get(key) ?? 0;
  if (count > allowed) {
    console.error(`FAIL: production lint debt regression for ${key} (${count} > allowlist ${allowed}).`);
    hasFailure = true;
  }
}

for (const [key, count] of allowlistMap.entries()) {
  const max = allowlistCapMap.get(key);
  if (max === undefined) {
    console.error(`FAIL: allowlist key ${key} is not present in allowlist ratchet cap.`);
    hasFailure = true;
    continue;
  }
  if (count > max) {
    console.error(`FAIL: allowlist ratchet regression for ${key} (${count} > cap ${max}).`);
    hasFailure = true;
  }
}

for (const [pkg, count] of Object.entries(warningCounts)) {
  const baseline = Number(warningBaseline[pkg] ?? 0);
  if (count > baseline) {
    console.error(`FAIL: production warning regression for ${pkg} (${count} > baseline ${baseline}).`);
    hasFailure = true;
  }
}

mkdirSync(path.dirname(WARNING_ARTIFACT_PATH), { recursive: true });
writeFileSync(
  WARNING_ARTIFACT_PATH,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceReport: path.relative(ROOT, REPORT_PATH).split(path.sep).join("/"),
      warningCounts,
      warningBaseline,
      productionViolationCount: Array.from(violations.values()).reduce((sum, value) => sum + Number(value), 0),
    },
    null,
    2
  ) + "\n"
);

if (hasFailure) {
  process.exit(1);
}

console.log("PASS: production ESLint profile ratchets are non-regressing.");
