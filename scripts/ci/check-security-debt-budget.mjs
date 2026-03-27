#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

function argValue(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), "utf8"));
}

const policyPath = argValue("--policy", "scripts/ci/appsec-debt-budget-policy.json");
const markdownOut = argValue("--report-md", "artifacts/security/appsec-debt-weekly-trend.md");
const jsonOut = argValue("--report-json", "artifacts/security/appsec-debt-weekly-trend.json");

const policy = readJson(policyPath);
const lintBaseline = readJson("scripts/ci/lint-ratchet-baseline.json");
const tsBaseline = readJson("config/valyntapp-ts-error-baseline.json");
const controlStatus = readJson("docs/security-compliance/control-status.json");

const ceilings = policy?.ceilings ?? {};
const lintCeilings = ceilings?.eslintWarnings ?? {};
const tsCeiling = Number(ceilings?.typescriptErrors?.valyntApp ?? Number.NaN);
const currentTsBaseline = Number(tsBaseline?.baseline ?? Number.NaN);

const failures = [];
const lintRows = [];

for (const [lane, ceiling] of Object.entries(lintCeilings)) {
  const current = Number(lintBaseline?.[lane]?.warnings ?? Number.NaN);
  const laneCeiling = Number(ceiling);
  const status = Number.isNaN(current) || Number.isNaN(laneCeiling)
    ? "invalid"
    : current > laneCeiling
      ? "fail"
      : "pass";

  lintRows.push({ lane, current, ceiling: laneCeiling, status });

  if (status === "invalid") {
    failures.push(`INVALID lint baseline for lane ${lane} (current=${String(current)}, ceiling=${String(laneCeiling)})`);
  } else if (status === "fail") {
    failures.push(`ESLINT_WARNING_BASELINE_REGRESSION lane=${lane} current=${current} ceiling=${laneCeiling}`);
  }
}

if (Number.isNaN(currentTsBaseline) || Number.isNaN(tsCeiling)) {
  failures.push(`INVALID TypeScript baseline/ceiling (current=${String(currentTsBaseline)}, ceiling=${String(tsCeiling)})`);
} else if (currentTsBaseline > tsCeiling) {
  failures.push(`TS_BASELINE_REGRESSION valynt-app current=${currentTsBaseline} ceiling=${tsCeiling}`);
}

const closedStatuses = new Set(["completed", "done", "closed", "accepted-risk", "waived"]);
const unresolvedCritical = (Array.isArray(controlStatus.controls) ? controlStatus.controls : []).filter((control) =>
  control?.severity === "critical" && !closedStatuses.has(String(control?.status ?? "").trim().toLowerCase())
);

const targetDates = unresolvedCritical
  .map((control) => typeof control?.targetDate === "string" ? control.targetDate : null)
  .filter(Boolean)
  .sort();

const now = new Date();
const isoTimestamp = now.toISOString();
const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
const weekStartIso = weekStart.toISOString().slice(0, 10);

const report = {
  generatedAt: isoTimestamp,
  weekStart: weekStartIso,
  policy: policyPath,
  overallStatus: failures.length > 0 ? "fail" : "pass",
  budgets: {
    eslintWarnings: lintRows,
    typescriptErrors: {
      lane: "valynt-app",
      currentBaseline: currentTsBaseline,
      ceiling: tsCeiling,
      status: Number.isNaN(currentTsBaseline) || Number.isNaN(tsCeiling)
        ? "invalid"
        : currentTsBaseline > tsCeiling
          ? "fail"
          : "pass",
    },
  },
  appsecDebt: {
    unresolvedCriticalCount: unresolvedCritical.length,
    soonestTargetDate: targetDates[0] ?? null,
    latestTargetDate: targetDates[targetDates.length - 1] ?? null,
  },
  failures,
};

const markdown = [
  "# Weekly AppSec Debt Trend",
  "",
  `- Generated: ${isoTimestamp}`,
  `- Week start (UTC): ${weekStartIso}`,
  `- Budget status: ${report.overallStatus === "pass" ? "✅ pass" : "❌ fail"}`,
  "",
  "## Security debt budget",
  "",
  "| Budget | Current baseline | Ceiling | Status |",
  "| --- | ---: | ---: | --- |",
  ...lintRows.map(({ lane, current, ceiling, status }) => `| ESLint warnings (${lane}) | ${current} | ${ceiling} | ${status} |`),
  `| TypeScript errors (valynt-app) | ${currentTsBaseline} | ${tsCeiling} | ${report.budgets.typescriptErrors.status} |`,
  "",
  "## Critical AppSec remediation backlog",
  "",
  `- Unresolved critical controls: ${unresolvedCritical.length}`,
  `- Soonest target date: ${report.appsecDebt.soonestTargetDate ?? "n/a"}`,
  `- Latest target date: ${report.appsecDebt.latestTargetDate ?? "n/a"}`,
  "",
];

if (failures.length > 0) {
  markdown.push("## Failures", "", ...failures.map((failure) => `- ${failure}`), "");
}

mkdirSync(dirname(resolve(ROOT, markdownOut)), { recursive: true });
mkdirSync(dirname(resolve(ROOT, jsonOut)), { recursive: true });
writeFileSync(resolve(ROOT, markdownOut), `${markdown.join("\n")}\n`, "utf8");
writeFileSync(resolve(ROOT, jsonOut), `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`AppSec debt weekly report written to ${markdownOut} and ${jsonOut}`);

if (failures.length > 0) {
  console.error("Security debt budget gate failed:");
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log("Security debt budget gate passed.");
