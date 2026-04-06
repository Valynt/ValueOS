#!/usr/bin/env node
/**
 * report-manifest-maturity-gaps.mjs
 *
 * Reads infra/k8s/manifest-maturity-ledger.json and emits a gap report
 * showing which critical manifest classes are not yet Validated and what
 * evidence is missing. Exits non-zero only when --fail-on-gaps is passed,
 * allowing use as a warning step in PR CI and a hard gate in pre-launch checks.
 *
 * Usage:
 *   node scripts/ci/report-manifest-maturity-gaps.mjs
 *   node scripts/ci/report-manifest-maturity-gaps.mjs --fail-on-gaps
 *   node scripts/ci/report-manifest-maturity-gaps.mjs --ledger-path=path/to/ledger.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function getArg(name, fallback = "") {
  const inline = process.argv.find((a) => a.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const LEDGER_PATH = getArg(
  "--ledger-path",
  "infra/k8s/manifest-maturity-ledger.json"
);
const FAIL_ON_GAPS = process.argv.includes("--fail-on-gaps");

const EVIDENCE_KEYS = [
  { label: "rollout_artifact", aliases: ["rollout_artifact", "rollout_evidence", "staging_deployment_result"] },
  { label: "load_test_artifact", aliases: ["load_test_artifact", "load_evidence", "load_test_summary"] },
  { label: "rollback_artifact", aliases: ["rollback_artifact", "rollback_evidence", "rollback_rehearsal"] },
];

const STATUS_RANK = { aspirational: 0, progressing: 1, validated: 2 };

function normalize(s) {
  return typeof s === "string" ? s.trim().toLowerCase() : "";
}

function isEmpty(v) {
  return typeof v !== "string" || v.trim().length === 0;
}

function isLink(v) {
  return /^(https?:\/\/|s3:\/\/|gs:\/\/|artifact:\/\/|gh:\/\/|urn:)/i.test(v);
}

function resolveEvidence(evidence, aliases) {
  for (const key of aliases) {
    const v = evidence?.[key];
    if (!isEmpty(v)) return v.trim();
  }
  return null;
}

// ── Load ledger ──────────────────────────────────────────────────────────────

const ledgerAbs = path.resolve(ROOT, LEDGER_PATH);
if (!fs.existsSync(ledgerAbs)) {
  console.error(`Ledger not found: ${LEDGER_PATH}`);
  process.exit(1);
}

const ledger = JSON.parse(fs.readFileSync(ledgerAbs, "utf8"));
const manifests = ledger.manifests ?? [];

// ── Analyse gaps ─────────────────────────────────────────────────────────────

const gaps = [];
const validated = [];

for (const entry of manifests) {
  if (!entry.critical) continue;

  const status = normalize(entry.status);
  const rank = STATUS_RANK[status] ?? -1;

  if (rank >= STATUS_RANK.validated) {
    validated.push(entry.class);
    continue;
  }

  const missing = [];

  if (isEmpty(entry.status_owner)) missing.push("status_owner");
  if (isEmpty(entry.date_validated)) missing.push("date_validated");

  for (const { label, aliases } of EVIDENCE_KEYS) {
    const value = resolveEvidence(entry.evidence, aliases);
    if (!value) {
      missing.push(`evidence.${label} (missing)`);
    } else if (!isLink(value)) {
      missing.push(`evidence.${label} (must be a URL/artifact URI, got: "${value}")`);
    }
  }

  gaps.push({ class: entry.class, status: entry.status, owner: entry.status_owner, missing });
}

// ── Emit report ──────────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const RED   = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const BOLD  = "\x1b[1m";

console.log(`\n${BOLD}Manifest Maturity Gap Report${RESET}`);
console.log(`Ledger: ${LEDGER_PATH}`);
console.log(`Schema version: ${ledger.schema_version ?? "unknown"}`);
console.log(`Last updated: ${ledger.last_updated ?? "unknown"}\n`);

if (validated.length > 0) {
  console.log(`${GREEN}✓ Validated critical classes (${validated.length}):${RESET}`);
  for (const c of validated) console.log(`  ${GREEN}✓${RESET} ${c}`);
  console.log();
}

if (gaps.length === 0) {
  console.log(`${GREEN}${BOLD}All critical manifest classes are Validated. Production gate will pass.${RESET}\n`);
  process.exit(0);
}

console.log(`${RED}${BOLD}⚠ Unvalidated critical classes (${gaps.length}):${RESET}\n`);

for (const gap of gaps) {
  console.log(`${BOLD}${gap.class}${RESET}  [status: ${YELLOW}${gap.status}${RESET}]  owner: ${gap.owner || "(unset)"}`);
  console.log(`  Missing fields:`);
  for (const m of gap.missing) {
    console.log(`    ${RED}✗${RESET} ${m}`);
  }
  console.log();
}

console.log(`${BOLD}How to resolve:${RESET}`);
console.log(`  See docs/runbooks/manifest-maturity-validation.md for the step-by-step`);
console.log(`  procedure to advance each class from Aspirational to Validated.\n`);

// Emit GitHub Actions step summary if running in CI
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## Manifest Maturity Gap Report",
    "",
    `| Class | Status | Owner | Missing |`,
    `|---|---|---|---|`,
  ];
  for (const gap of gaps) {
    lines.push(`| \`${gap.class}\` | ${gap.status} | ${gap.owner || "—"} | ${gap.missing.join(", ")} |`);
  }
  lines.push("");
  lines.push(`> See [docs/runbooks/manifest-maturity-validation.md](docs/runbooks/manifest-maturity-validation.md) for the validation procedure.`);
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

if (FAIL_ON_GAPS) {
  console.error(`${RED}Exiting non-zero: ${gaps.length} critical class(es) not yet Validated.${RESET}`);
  process.exit(1);
}

// Without --fail-on-gaps: warn only (used in PR CI to surface progress)
console.log(`${YELLOW}Warning only (--fail-on-gaps not set). Production deploy will still be blocked by manifest-maturity-production-gate.${RESET}\n`);
