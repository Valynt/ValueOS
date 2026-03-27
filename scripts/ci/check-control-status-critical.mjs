#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTROL_STATUS_PATH = resolve("docs/security-compliance/control-status.json");
const TODAY_UTC = new Date().toISOString().slice(0, 10);

const RELEVANT_FRAMEWORKS = new Set(["SOC2", "HIPAA"]);
const RELEVANT_DOMAINS = new Set([
  "tenant-isolation",
  "access-control",
  "audit-logging",
  "secrets-management",
  "privacy-phi",
  "security-testing",
]);
const CLOSED_STATUSES = new Set(["completed", "done", "closed", "accepted-risk", "waived"]);

function parseDateOnly(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return normalized;
}

function isRelevant(control) {
  const frameworks = Array.isArray(control.frameworks) ? control.frameworks : [];
  const matchesFramework = frameworks.some((framework) => RELEVANT_FRAMEWORKS.has(String(framework).toUpperCase()));

  return (
    control?.severity === "critical" &&
    matchesFramework &&
    RELEVANT_DOMAINS.has(control?.domain)
  );
}

function isClosedStatus(status) {
  if (typeof status !== "string") {
    return false;
  }

  return CLOSED_STATUSES.has(status.trim().toLowerCase());
}

const payload = JSON.parse(readFileSync(CONTROL_STATUS_PATH, "utf8"));
const controls = Array.isArray(payload.controls) ? payload.controls : [];

const failures = [];

for (const control of controls) {
  if (!isRelevant(control)) {
    continue;
  }

  if (isClosedStatus(control.status)) {
    continue;
  }

  const remediationOwner = typeof control?.remediation?.owner === "string"
    ? control.remediation.owner.trim()
    : "";
  const owner = remediationOwner || (typeof control.owner === "string" ? control.owner.trim() : "");
  if (!owner) {
    failures.push(`UNOWNED ${control.id}: ${control.control}`);
    continue;
  }

  const remediationTargetDate = parseDateOnly(control?.remediation?.targetDate);
  const targetDate = remediationTargetDate ?? parseDateOnly(control.targetDate);
  if (!targetDate) {
    failures.push(`INVALID_TARGET_DATE ${control.id}: ${control.control} (targetDate=${String(control.targetDate)})`);
    continue;
  }

  if (!remediationOwner || !remediationTargetDate) {
    failures.push(
      `MISSING_REMEDIATION_METADATA ${control.id}: ${control.control} (require remediation.owner + remediation.targetDate)`,
    );
    continue;
  }

  if (targetDate < TODAY_UTC) {
    failures.push(`STALE ${control.id}: ${control.control} (owner=${owner}, targetDate=${targetDate})`);
  }
}

if (failures.length > 0) {
  console.error("Critical SOC2/HIPAA controls are stale or unowned:");
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Control status gate passed for ${controls.length} records (${TODAY_UTC}). No stale/unowned critical SOC2/HIPAA controls found.`,
);
