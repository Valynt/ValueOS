#!/usr/bin/env node
/**
 * Parses a Trivy JSON vulnerability report and fails if the number of
 * critical or high CVEs exceeds the specified thresholds.
 *
 * Usage:
 *   node scripts/ci/check-trivy-thresholds.mjs \
 *     --report artifacts/trivy/backend-trivy.json \
 *     --fail-on-critical 0 \
 *     --fail-on-high 0 \
 *     --image backend
 */

import fs from "node:fs";

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { report: null, failOnCritical: 0, failOnHigh: 0, image: "unknown" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--report") result.report = args[++i];
    if (args[i] === "--fail-on-critical") result.failOnCritical = parseInt(args[++i], 10);
    if (args[i] === "--fail-on-high") result.failOnHigh = parseInt(args[++i], 10);
    if (args[i] === "--image") result.image = args[++i];
  }
  if (!result.report) {
    console.error("Usage: check-trivy-thresholds.mjs --report <path> [--fail-on-critical N] [--fail-on-high N] [--image name]");
    process.exit(1);
  }
  return result;
}

const { report: reportPath, failOnCritical, failOnHigh, image } = parseArgs();

if (!fs.existsSync(reportPath)) {
  console.error(`Trivy report not found: ${reportPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(reportPath, "utf8");
let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error(`Failed to parse Trivy report: ${reportPath}`);
  process.exit(1);
}

// Trivy JSON schema: { Results: [{ Vulnerabilities: [{ Severity, VulnerabilityID, ... }] }] }
const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
const blocking = [];

for (const result of report.Results ?? []) {
  for (const vuln of result.Vulnerabilities ?? []) {
    const sev = (vuln.Severity ?? "UNKNOWN").toUpperCase();
    counts[sev] = (counts[sev] ?? 0) + 1;

    if (
      (sev === "CRITICAL" && counts.CRITICAL > failOnCritical) ||
      (sev === "HIGH" && counts.HIGH > failOnHigh)
    ) {
      blocking.push({
        id: vuln.VulnerabilityID,
        severity: sev,
        pkg: vuln.PkgName,
        installed: vuln.InstalledVersion,
        fixed: vuln.FixedVersion ?? "no fix available",
        title: vuln.Title ?? "",
      });
    }
  }
}

const summary = Object.entries(counts)
  .filter(([, n]) => n > 0)
  .map(([s, n]) => `${s}: ${n}`)
  .join(", ");

if (blocking.length > 0) {
  console.error(`\n❌ Trivy [${image}]: vulnerability thresholds exceeded (${summary})\n`);
  console.error(`Thresholds: CRITICAL ≤ ${failOnCritical}, HIGH ≤ ${failOnHigh}\n`);
  for (const v of blocking) {
    console.error(`  [${v.severity}] ${v.id} — ${v.pkg}@${v.installed} (fix: ${v.fixed})`);
    if (v.title) console.error(`    ${v.title}`);
  }
  console.error(`\nRemediate by updating affected packages or adding a documented suppression`);
  console.error(`to .trivyignore with justification and expiry date.`);
  process.exit(1);
}

console.log(`✅ Trivy [${image}]: ${summary || "no vulnerabilities found"} — within thresholds (CRITICAL ≤ ${failOnCritical}, HIGH ≤ ${failOnHigh})`);
