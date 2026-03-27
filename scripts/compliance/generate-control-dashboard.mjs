#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const CONTROL_STATUS_PATH = resolve("docs/security-compliance/control-status.json");

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback;
  }

  return process.argv[index + 1];
}

const markdownOut = resolve(argValue("--markdown-out", "release-artifacts/compliance/control-dashboard.md"));
const jsonOut = resolve(argValue("--json-out", "release-artifacts/compliance/control-dashboard.json"));

const payload = JSON.parse(readFileSync(CONTROL_STATUS_PATH, "utf8"));
const controls = Array.isArray(payload.controls) ? payload.controls : [];

const totals = {
  all: controls.length,
  critical: 0,
  overdueCriticalOpen: 0,
  missingOwnerCritical: 0,
  missingEvidenceCritical: 0,
};

const today = new Date().toISOString().slice(0, 10);
const criticalRows = [];

for (const control of controls) {
  const isCritical = String(control.severity || "").toLowerCase() === "critical";
  if (!isCritical) {
    continue;
  }

  totals.critical += 1;

  const owner = typeof control.owner === "string" ? control.owner.trim() : "";
  const evidence = typeof control.evidenceLocation === "string" ? control.evidenceLocation.trim() : "";
  const targetDate = typeof control.targetDate === "string" ? control.targetDate.trim() : "";
  const status = typeof control.status === "string" ? control.status.trim() : "unknown";
  const isClosed = ["completed", "done", "closed", "accepted-risk", "waived"].includes(status.toLowerCase());

  if (!owner) {
    totals.missingOwnerCritical += 1;
  }
  if (!evidence) {
    totals.missingEvidenceCritical += 1;
  }
  if (!isClosed && /^\d{4}-\d{2}-\d{2}$/.test(targetDate) && targetDate < today) {
    totals.overdueCriticalOpen += 1;
  }

  criticalRows.push({
    id: control.id,
    framework: Array.isArray(control.frameworks) ? control.frameworks.join(", ") : "",
    status,
    owner: owner || "(missing)",
    targetDate: targetDate || "(missing)",
    evidenceLocation: evidence || "(missing)",
    control: control.control || "",
  });
}

mkdirSync(dirname(markdownOut), { recursive: true });
mkdirSync(dirname(jsonOut), { recursive: true });

const markdown = [
  "# Auditor-ready Control Dashboard",
  "",
  `- Generated at (UTC): ${new Date().toISOString()}`,
  `- Source: ${CONTROL_STATUS_PATH}`,
  `- Total controls: ${totals.all}`,
  `- Critical controls: ${totals.critical}`,
  `- Overdue open critical controls: ${totals.overdueCriticalOpen}`,
  `- Critical controls missing owner: ${totals.missingOwnerCritical}`,
  `- Critical controls missing evidence link/location: ${totals.missingEvidenceCritical}`,
  "",
  "## Critical controls",
  "",
  "| ID | Framework | Status | Owner | Target date | Evidence link/location | Control |",
  "|---|---|---|---|---|---|---|",
  ...criticalRows.map((row) => `| ${row.id} | ${row.framework} | ${row.status} | ${row.owner} | ${row.targetDate} | ${row.evidenceLocation} | ${row.control.replace(/\|/g, "\\|")} |`),
  "",
].join("\n");

writeFileSync(markdownOut, markdown, "utf8");
writeFileSync(
  jsonOut,
  `${JSON.stringify({ generatedAtUtc: new Date().toISOString(), today, totals, criticalControls: criticalRows }, null, 2)}\n`,
  "utf8",
);

console.log(`Wrote ${markdownOut}`);
console.log(`Wrote ${jsonOut}`);
