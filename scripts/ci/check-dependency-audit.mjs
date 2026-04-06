#!/usr/bin/env node
/**
 * Parses a pnpm audit JSON report and fails if any advisory meets or exceeds
 * the specified severity threshold.
 *
 * Usage:
 *   node scripts/ci/check-dependency-audit.mjs \
 *     --report artifacts/audit/pnpm-audit.json \
 *     --fail-on high
 *
 * Severity order (ascending): info < low < moderate < high < critical
 */

import fs from "node:fs";
import path from "node:path";

const SEVERITY_ORDER = ["info", "low", "moderate", "high", "critical"];

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { report: null, failOn: "high" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--report") result.report = args[++i];
    if (args[i] === "--fail-on") result.failOn = args[++i];
  }
  if (!result.report) {
    console.error("Usage: check-dependency-audit.mjs --report <path> [--fail-on <severity>]");
    process.exit(1);
  }
  return result;
}

function severityIndex(s) {
  const idx = SEVERITY_ORDER.indexOf(s.toLowerCase());
  return idx === -1 ? 0 : idx;
}

const { report: reportPath, failOn } = parseArgs();
const failThreshold = severityIndex(failOn);

if (!fs.existsSync(reportPath)) {
  console.error(`Audit report not found: ${reportPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(reportPath, "utf8");
let audit;
try {
  audit = JSON.parse(raw);
} catch {
  console.error(`Failed to parse audit report: ${reportPath}`);
  process.exit(1);
}

// pnpm audit --json shape: { advisories: { [id]: { severity, title, ... } } }
const advisories = audit.advisories ?? {};
const blocking = [];

for (const [id, advisory] of Object.entries(advisories)) {
  if (severityIndex(advisory.severity) >= failThreshold) {
    blocking.push({
      id,
      severity: advisory.severity,
      title: advisory.title,
      module: advisory.module_name,
      url: advisory.url,
    });
  }
}

if (blocking.length > 0) {
  console.error(`\n❌ Dependency audit: ${blocking.length} advisory(ies) at or above '${failOn}' severity:\n`);
  for (const a of blocking) {
    console.error(`  [${a.severity.toUpperCase()}] ${a.module} — ${a.title}`);
    console.error(`    ${a.url}`);
  }
  console.error(`\nRemediate with: pnpm audit --fix`);
  console.error(`Or add a documented exception to scripts/ci/audit-exceptions.json`);
  process.exit(1);
}

const total = Object.keys(advisories).length;
console.log(`✅ Dependency audit: ${total} total advisories, 0 at or above '${failOn}' severity.`);
