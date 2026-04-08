#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTROL_STATUS_PATH = resolve("docs/security-compliance/control-status.json");
const RISK_REGISTER_PATH = resolve("docs/security-compliance/risk-register.json");
const VDP_METRICS_SOURCE_PATH = resolve("docs/security-compliance/vdp-metrics-source.json");

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
  const vdpMetricsPayload = safeParseJson(VDP_METRICS_SOURCE_PATH, { quarterlySnapshots: [] });

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

  const quarterlySnapshots = Array.isArray(vdpMetricsPayload.quarterlySnapshots)
    ? vdpMetricsPayload.quarterlySnapshots
    : [];

  const latestQuarterSnapshot =
    quarterlySnapshots.length > 0 ? quarterlySnapshots[quarterlySnapshots.length - 1] : null;

  writeFileSync(
    vdpKpiOutputPath,
    `${JSON.stringify(
      {
        asOfDate: options.asOfDate,
        publicPolicyPath: vdpMetricsPayload.publicPolicyPath ?? null,
        intakeChannel: vdpMetricsPayload.intakeChannel ?? null,
        ownershipAndEscalation: vdpMetricsPayload.ownershipAndEscalation ?? null,
        slaTargets: vdpMetricsPayload.slaTargets ?? null,
        kpiAutomation: vdpMetricsPayload.kpiAutomation ?? null,
        latestQuarterSnapshot,
        quarterlySnapshotCount: quarterlySnapshots.length,
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    `[governance-kpi] extracted ${openRisks.length} open risks, ${staleControls.length} stale controls, and ${quarterlySnapshots.length} VDP quarter snapshots into ${options.outputDir}`,
  );
}

main();
