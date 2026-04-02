#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTROL_STATUS_PATH = resolve("docs/security-compliance/control-status.json");
const EXCEPTIONS_PATH = resolve("docs/security-compliance/control-status-exceptions.json");
const ARTIFACT_DIR = resolve("artifacts/compliance/control-status-gate");
const ARTIFACT_JSON_PATH = resolve(ARTIFACT_DIR, "status.json");
const ARTIFACT_MD_PATH = resolve(ARTIFACT_DIR, "summary.md");
const TODAY_UTC = new Date().toISOString().slice(0, 10);

const RELEVANT_FRAMEWORKS = new Set(["SOC2", "HIPAA"]);
const RELEVANT_DOMAINS = new Set([
  "tenant-isolation",
  "auth",
  "authentication",
  "access-control",
  "audit-logging",
]);
const HIGH_RISK_SEVERITIES = new Set(["critical", "high"]);
const CRITICAL_SEVERITY = "critical";
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
  const severity = typeof control?.severity === "string" ? control.severity.trim().toLowerCase() : "";
  const domain = typeof control?.domain === "string" ? control.domain.trim().toLowerCase() : "";

  return (
    HIGH_RISK_SEVERITIES.has(severity) &&
    matchesFramework &&
    RELEVANT_DOMAINS.has(domain)
  );
}

function isCritical(control) {
  const severity = typeof control?.severity === "string" ? control.severity.trim().toLowerCase() : "";
  const frameworks = Array.isArray(control.frameworks) ? control.frameworks : [];
  const matchesFramework = frameworks.some((framework) => RELEVANT_FRAMEWORKS.has(String(framework).toUpperCase()));
  return severity === CRITICAL_SEVERITY && matchesFramework;
}

function isClosedStatus(status) {
  if (typeof status !== "string") {
    return false;
  }

  return CLOSED_STATUSES.has(status.trim().toLowerCase());
}

function loadJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeException(rawException, issues) {
  const controlId = typeof rawException?.controlId === "string" ? rawException.controlId.trim() : "";
  const ticket = typeof rawException?.ticket === "string" ? rawException.ticket.trim() : "";
  const approver = typeof rawException?.approver === "string" ? rawException.approver.trim() : "";
  const expiresOn = parseDateOnly(rawException?.expiresOn);
  const reason = typeof rawException?.reason === "string" ? rawException.reason.trim() : "";

  if (!controlId) {
    issues.push(`INVALID_EXCEPTION missing controlId in ${EXCEPTIONS_PATH}`);
    return null;
  }
  if (!ticket) {
    issues.push(`INVALID_EXCEPTION ${controlId}: missing ticket`);
    return null;
  }
  if (!approver) {
    issues.push(`INVALID_EXCEPTION ${controlId}: missing approver`);
    return null;
  }
  if (!expiresOn) {
    issues.push(`INVALID_EXCEPTION ${controlId}: invalid expiresOn=${String(rawException?.expiresOn)}`);
    return null;
  }

  return { controlId, ticket, approver, expiresOn, reason };
}

function writeArtifacts(report) {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeFileSync(ARTIFACT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const lines = [
    "# Control Status Gate",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- date: ${report.date}`,
    `- controlsEvaluated: ${report.controlsEvaluated}`,
    `- failures: ${report.failures.length}`,
    `- exceptionsApplied: ${report.exceptionsApplied.length}`,
    `- result: ${report.result}`,
    "",
  ];

  if (report.failures.length > 0) {
    lines.push("## Failures", "");
    for (const failure of report.failures) {
      lines.push(`- ${failure}`);
    }
    lines.push("");
  }

  if (report.exceptionsApplied.length > 0) {
    lines.push("## Exceptions Applied", "");
    for (const item of report.exceptionsApplied) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  writeFileSync(ARTIFACT_MD_PATH, `${lines.join("\n")}\n`, "utf8");
}

function isLikelyUrl(value) {
  return /^https?:\/\//i.test(value);
}

function hasEvidenceLink(control) {
  const evidenceLocation = typeof control?.evidenceLocation === "string"
    ? control.evidenceLocation.trim()
    : "";

  if (!evidenceLocation) {
    return false;
  }

  if (isLikelyUrl(evidenceLocation)) {
    return true;
  }

  try {
    const stat = readFileSync(resolve(evidenceLocation), "utf8");
    return stat.length > 0;
  } catch {
    return false;
  }
}

const payload = JSON.parse(readFileSync(CONTROL_STATUS_PATH, "utf8"));
const controls = Array.isArray(payload.controls) ? payload.controls : [];
const exceptionPayload = loadJson(EXCEPTIONS_PATH, { exceptions: [] });
const rawExceptions = Array.isArray(exceptionPayload.exceptions) ? exceptionPayload.exceptions : [];

const failures = [];
const exceptionIssues = [];
const exceptionsApplied = [];
const validExceptions = new Map();

for (const rawException of rawExceptions) {
  const normalized = normalizeException(rawException, exceptionIssues);
  if (!normalized) {
    continue;
  }
  if (normalized.expiresOn < TODAY_UTC) {
    exceptionIssues.push(`EXPIRED_EXCEPTION ${normalized.controlId}: expired on ${normalized.expiresOn}`);
    continue;
  }
  validExceptions.set(normalized.controlId, normalized);
}

for (const control of controls) {
  if (!isRelevant(control)) {
    continue;
  }

  if (isClosedStatus(control.status)) {
    continue;
  }

  const exception = validExceptions.get(control.id);
  if (exception) {
    exceptionsApplied.push(
      `${control.id}: ticket=${exception.ticket}, approver=${exception.approver}, expiresOn=${exception.expiresOn}`,
    );
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

  if (isCritical(control) && !hasEvidenceLink(control)) {
    failures.push(`MISSING_EVIDENCE_LINK ${control.id}: ${control.control}`);
    continue;
  }

  const remediationTargetDate = parseDateOnly(control?.remediation?.targetDate);
  const targetDate = remediationTargetDate ?? parseDateOnly(control.targetDate);
  if (!targetDate) {
    failures.push(`INVALID_TARGET_DATE ${control.id}: ${control.control} (targetDate=${String(control.targetDate)})`);
    continue;
  }

const status = typeof control.status === "string" ? control.status.trim().toLowerCase() : "";

  if (!remediationOwner || !remediationTargetDate) {
    failures.push(
      `MISSING_REMEDIATION_METADATA ${control.id}: ${control.control} (require remediation.owner + remediation.targetDate)`,
    );
    continue;
  }

  if (status === "planned" && targetDate < TODAY_UTC) {
    failures.push(`STALE ${control.id}: ${control.control} (owner=${owner}, targetDate=${targetDate})`);
  }
}

for (const issue of exceptionIssues) {
  failures.push(issue);
}

const relevantControlsCount = controls.filter(isRelevant).length;
const criticalControlsCount = controls.filter(isCritical).length;

for (const control of controls) {
  if (!isCritical(control)) {
    continue;
  }

  const status = typeof control.status === "string" ? control.status.trim().toLowerCase() : "";
  if (isClosedStatus(status)) {
    continue;
  }

  const remediationOwner = typeof control?.remediation?.owner === "string"
    ? control.remediation.owner.trim()
    : "";
  const owner = remediationOwner || (typeof control.owner === "string" ? control.owner.trim() : "");

  if (!owner) {
    failures.push(`CRITICAL_UNOWNED ${control.id}: ${control.control}`);
  }

  if (!hasEvidenceLink(control)) {
    failures.push(`CRITICAL_MISSING_EVIDENCE_LINK ${control.id}: ${control.control}`);
  }

  const targetDate = parseDateOnly(control?.remediation?.targetDate) ?? parseDateOnly(control?.targetDate);
  if (!targetDate) {
    failures.push(`CRITICAL_INVALID_TARGET_DATE ${control.id}: ${control.control}`);
    continue;
  }

  if (targetDate < TODAY_UTC) {
    failures.push(`CRITICAL_PAST_DUE ${control.id}: ${control.control} (owner=${owner || "unassigned"}, targetDate=${targetDate})`);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  date: TODAY_UTC,
  controlsEvaluated: relevantControlsCount,
  criticalControlsEvaluated: criticalControlsCount,
  failures,
  exceptionsApplied,
  result: failures.length === 0 ? "pass" : "fail",
};

writeArtifacts(report);

if (failures.length > 0) {
  console.error("High-risk SOC2/HIPAA controls in tenant-isolation/auth/audit domains are non-compliant:");
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  console.error(`Compliance artifact written: ${ARTIFACT_JSON_PATH}`);
  process.exit(1);
}

console.log(
  `Control status gate passed for ${relevantControlsCount} high-risk controls (${TODAY_UTC}). Artifact: ${ARTIFACT_JSON_PATH}`,
);
