#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTROL_STATUS_PATH = resolve("docs/security-compliance/control-status.json");
const RISK_REGISTER_PATH = resolve("docs/security-compliance/risk-register.json");
const VDP_METRICS_PATH = resolve("docs/security-compliance/vdp-metrics.json");

const CLOSED_CONTROL_STATUSES = new Set(["completed", "done", "closed", "accepted-risk", "waived"]);
const CLOSED_RISK_STATUSES = new Set(["mitigated", "closed"]);
const CRITICAL_RISK_LEVELS = new Set(["critical"]);

function parseArgs(argv) {
  const options = {
    outputDir: resolve("artifacts/security/governance"),
    asOfDate: new Date().toISOString().slice(0, 10),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output-dir") {
      options.outputDir = resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--as-of-date") {
      options.asOfDate = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

function safeParseJson(filePath, emptyValue) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return emptyValue;
  }
}

function parseDateOnly(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function daysBetween(fromDate, toDate) {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    return null;
  }

  return Math.floor((to - from) / (24 * 60 * 60 * 1000));
}

function isClosedControlStatus(status) {
  if (typeof status !== "string") {
    return false;
  }

  return CLOSED_CONTROL_STATUSES.has(status.trim().toLowerCase());
}


function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function calculatePercentage(numerator, denominator) {
  if (typeof numerator !== "number" || typeof denominator !== "number" || denominator <= 0) {
    return null;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

function sanitizeSeverityWindow(value) {
  if (!value || typeof value !== "object") {
    return { withinSla: 0, total: 0, adherencePct: null };
  }

  const withinSla = safeNumber(value.withinSla) ?? 0;
  const total = safeNumber(value.total) ?? 0;
  return {
    withinSla,
    total,
    adherencePct: calculatePercentage(withinSla, total),
  };
}

function buildVdpKpiSnapshot(vdpPayload, asOfDate) {
  const program = vdpPayload && typeof vdpPayload.program === "object" ? vdpPayload.program : {};
  const slaTargets = vdpPayload && typeof vdpPayload.slaTargets === "object" ? vdpPayload.slaTargets : {};
  const quarterlySnapshot =
    vdpPayload && typeof vdpPayload.quarterlySnapshot === "object" ? vdpPayload.quarterlySnapshot : {};
  const ownership = vdpPayload && typeof vdpPayload.ownership === "object" ? vdpPayload.ownership : {};

  const reportsReceived = safeNumber(quarterlySnapshot.reportsReceived) ?? 0;
  const reportsValidated = safeNumber(quarterlySnapshot.reportsValidated) ?? 0;
  const firstResponseWithinSlaCount = safeNumber(quarterlySnapshot.firstResponseWithinSlaCount) ?? 0;
  const triageWithinSlaCount = safeNumber(quarterlySnapshot.triageWithinSlaCount) ?? 0;
  const remediationBySeverity =
    quarterlySnapshot.remediationWithinSlaBySeverity &&
    typeof quarterlySnapshot.remediationWithinSlaBySeverity === "object"
      ? quarterlySnapshot.remediationWithinSlaBySeverity
      : {};

  const openSlaBreaches = Array.isArray(quarterlySnapshot.openSlaBreaches)
    ? quarterlySnapshot.openSlaBreaches
    : [];

  return {
    asOfDate,
    quarter: typeof quarterlySnapshot.quarter === "string" ? quarterlySnapshot.quarter : null,
    period: {
      start: parseDateOnly(quarterlySnapshot.periodStart),
      end: parseDateOnly(quarterlySnapshot.periodEnd),
    },
    intake: {
      policyUrl: typeof program.publicPolicyUrl === "string" ? program.publicPolicyUrl : null,
      channels: Array.isArray(program.intakeChannels) ? program.intakeChannels : [],
    },
    slaTargets: {
      timeToFirstResponseBusinessDays: safeNumber(slaTargets.timeToFirstResponseBusinessDays),
      triageCompletionBusinessDays: safeNumber(slaTargets.triageCompletionBusinessDays),
      remediationWindowDaysBySeverity:
        slaTargets.remediationWindowDaysBySeverity &&
        typeof slaTargets.remediationWindowDaysBySeverity === "object"
          ? slaTargets.remediationWindowDaysBySeverity
          : {},
    },
    kpis: {
      reportsReceived,
      reportsValidated,
      firstResponseSlaAdherencePct: calculatePercentage(firstResponseWithinSlaCount, reportsValidated),
      triageSlaAdherencePct: calculatePercentage(triageWithinSlaCount, reportsValidated),
      remediationSlaAdherenceBySeverity: {
        critical: sanitizeSeverityWindow(remediationBySeverity.critical),
        high: sanitizeSeverityWindow(remediationBySeverity.high),
        medium: sanitizeSeverityWindow(remediationBySeverity.medium),
        low: sanitizeSeverityWindow(remediationBySeverity.low),
      },
      openSlaBreachCount: openSlaBreaches.length,
      openSlaBreaches,
    },
    ownershipAndEscalation: ownership,
    generatedBy: "scripts/ci/extract-governance-risk-control-kpis.mjs",
  };
}

function isClosedRiskStatus(status) {
  if (typeof status !== "string") {
    return false;
  }

  return CLOSED_RISK_STATUSES.has(status.trim().toLowerCase());
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(options.outputDir, { recursive: true });

  const controlPayload = safeParseJson(CONTROL_STATUS_PATH, { controls: [] });
  const riskPayload = safeParseJson(RISK_REGISTER_PATH, { risks: [] });
  const vdpPayload = safeParseJson(VDP_METRICS_PATH, {});

  const controls = Array.isArray(controlPayload.controls) ? controlPayload.controls : [];
  const risks = Array.isArray(riskPayload.risks) ? riskPayload.risks : [];

  const openRisks = risks
    .filter((risk) => !isClosedRiskStatus(risk.status))
    .map((risk) => {
      const createdDate = parseDateOnly(risk.createdDate);
      const ageDays = createdDate ? daysBetween(createdDate, options.asOfDate) : null;
      return {
        riskId: risk.riskId,
        title: risk.title,
        severity: risk.severity,
        status: risk.status,
        owner: risk.owner,
        targetDueDate: risk.targetDueDate,
        createdDate,
        ageDays,
      };
    });

  const openCriticalRisks = openRisks.filter((risk) => CRITICAL_RISK_LEVELS.has(String(risk.severity).toLowerCase()));
  const openCriticalRiskAges = openCriticalRisks
    .map((risk) => risk.ageDays)
    .filter((value) => typeof value === "number");

  const openCriticalRiskAgeDays =
    openCriticalRiskAges.length > 0 ? Math.max(...openCriticalRiskAges) : null;

  const staleControls = controls
    .filter((control) => !isClosedControlStatus(control.status))
    .map((control) => {
      const targetDate = parseDateOnly(control.targetDate);
      const ageDays = targetDate ? daysBetween(targetDate, options.asOfDate) : null;
      const stale = targetDate ? targetDate < options.asOfDate : true;
      return {
        id: control.id,
        control: control.control,
        severity: control.severity,
        status: control.status,
        owner: control.owner,
        targetDate,
        stale,
        daysPastDue: stale && typeof ageDays === "number" ? ageDays : null,
        evidenceLocation: control.evidenceLocation,
      };
    })
    .filter((control) => control.stale);

  const evidenceCoverageTotal = controls.length;
  const evidenceCoverageComplete = controls.filter((control) => typeof control.evidenceLocation === "string" && control.evidenceLocation.trim().length > 0).length;

  const openRiskOutputPath = resolve(options.outputDir, "open-risks.json");
  const staleControlOutputPath = resolve(options.outputDir, "stale-controls.json");
  const snapshotOutputPath = resolve(options.outputDir, "trust-kpi-snapshot.json");
  const vdpKpiOutputPath = resolve(options.outputDir, "vdp-kpis.json");

  writeFileSync(openRiskOutputPath, `${JSON.stringify({ asOfDate: options.asOfDate, openRisks }, null, 2)}\n`);
  writeFileSync(staleControlOutputPath, `${JSON.stringify({ asOfDate: options.asOfDate, staleControls }, null, 2)}\n`);
  writeFileSync(
    snapshotOutputPath,
    `${JSON.stringify(
      {
        asOfDate: options.asOfDate,
        kpis: {
          controlFreshness: {
            description: "Percentage of controls that are not stale as of snapshot date.",
            numerator: evidenceCoverageTotal - staleControls.length,
            denominator: evidenceCoverageTotal,
            value: evidenceCoverageTotal > 0 ? Number((((evidenceCoverageTotal - staleControls.length) / evidenceCoverageTotal) * 100).toFixed(2)) : null,
          },
          openCriticalRiskAgeDays,
          evidenceCompleteness: {
            description: "Percentage of controls with non-empty evidenceLocation fields.",
            numerator: evidenceCoverageComplete,
            denominator: evidenceCoverageTotal,
            value: evidenceCoverageTotal > 0 ? Number(((evidenceCoverageComplete / evidenceCoverageTotal) * 100).toFixed(2)) : null,
          },
          openRiskCount: openRisks.length,
          staleControlCount: staleControls.length,
        },
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    vdpKpiOutputPath,
    `${JSON.stringify(buildVdpKpiSnapshot(vdpPayload, options.asOfDate), null, 2)}\n`,
  );

  console.log(
    `[governance-kpi] extracted ${openRisks.length} open risks, ${staleControls.length} stale controls, and VDP KPI snapshot into ${options.outputDir}`,
  );
}

main();
