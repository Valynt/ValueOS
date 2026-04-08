#!/usr/bin/env node

import { readFileSync } from "node:fs";

const REQUIRED_DOMAINS = ["security", "tenant-isolation", "accessibility", "reliability"];

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseMarkdownTable(section) {
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  if (lines.length < 3) return [];
  const headerCells = lines[0]
    .split("|")
    .slice(1, -1)
    .map((cell) => normalizeKey(cell));

  const rows = [];
  for (const line of lines.slice(2)) {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== headerCells.length) continue;
    const row = {};
    headerCells.forEach((key, idx) => {
      row[key] = cells[idx];
    });
    rows.push(row);
  }
  return rows;
}

export function parseControlPlaneMatrix(matrixPath, workflowFile) {
  const raw = readFileSync(matrixPath, "utf8");
  const marker = "## Control Plane Required Gate Matrix";
  const start = raw.indexOf(marker);
  if (start === -1) {
    throw new Error(`Missing \"${marker}\" in ${matrixPath}`);
  }

  const after = raw.slice(start + marker.length);
  const nextHeading = after.search(/\n##\s+/);
  const section = nextHeading === -1 ? after : after.slice(0, nextHeading);
  const rows = parseMarkdownTable(section);

  const filtered = rows
    .filter((row) => row.workflow === `\`${workflowFile}\`` || row.workflow === workflowFile)
    .map((row) => ({
      workflow: row.workflow.replace(/`/g, ""),
      domain: normalizeKey(row.domain),
      gateId:
        row["required-gate-job-id"]?.replace(/`/g, "") ||
        row.requiredgatejobid?.replace(/`/g, ""),
      required: normalizeKey(row.required) !== "no",
      waiverJustification:
        row["waiver-justification"] || row.waiverjustification || "",
    }));

  return filtered;
}

function normalizeJobs(jobs) {
  const map = new Map();
  for (const job of jobs) {
    const key = normalizeKey(job.id || job.name);
    map.set(key, {
      id: key,
      rawName: job.name,
      rawId: job.id,
      conclusion: (job.conclusion || "unknown").toLowerCase(),
      status: (job.status || "").toLowerCase(),
      html_url: job.html_url || null,
    });
  }
  return map;
}

export function evaluateControlPlane({ matrixRows, jobs, workflowFile, runId, runAttempt }) {
  const jobMap = normalizeJobs(jobs);
  const failures = [];
  const skippedWaivedLedger = [];

  const gateResults = {};
  for (const domain of REQUIRED_DOMAINS) {
    const domainRows = matrixRows.filter((row) => row.domain === domain);
    if (domainRows.length === 0) {
      failures.push(`Missing required matrix row for domain \"${domain}\" in ${workflowFile}`);
      gateResults[domain] = { required: true, status: "missing-matrix-entry", gates: [] };
      continue;
    }

    const gates = domainRows.map((row) => {
      const gateKey = normalizeKey(row.gateId);
      const actual = jobMap.get(gateKey);
      if (!actual) {
        failures.push(`Mapped gate \"${row.gateId}\" for domain \"${domain}\" was not found in executed jobs`);
        return {
          gate_id: row.gateId,
          required: row.required,
          status: "missing",
        };
      }

      if (row.required && actual.conclusion === "skipped") {
        failures.push(`Required gate \"${row.gateId}\" for domain \"${domain}\" was skipped`);
      }
      if (row.required && ["failure", "cancelled", "timed_out", "action_required"].includes(actual.conclusion)) {
        failures.push(`Required gate \"${row.gateId}\" for domain \"${domain}\" concluded ${actual.conclusion}`);
      }

      if (actual.conclusion === "skipped") {
        skippedWaivedLedger.push({
          type: "skipped_gate",
          domain,
          gate_id: row.gateId,
          required: row.required,
          justification:
            row.waiverJustification ||
            "GitHub Actions marked this job as skipped (conditional or unmet prerequisite).",
        });
      }

      if (!row.required) {
        skippedWaivedLedger.push({
          type: "waived_control",
          domain,
          gate_id: row.gateId,
          required: false,
          justification: row.waiverJustification || "Control explicitly marked non-required in control matrix.",
        });
      }

      return {
        gate_id: row.gateId,
        required: row.required,
        status: actual.conclusion,
        job_name: actual.rawName,
        job_url: actual.html_url,
      };
    });

    const hasFailure = gates.some((g) => ["failure", "cancelled", "timed_out", "action_required", "missing", "skipped"].includes(g.status));
    gateResults[domain] = {
      required: true,
      status: hasFailure ? "failed" : "passed",
      gates,
    };
  }

  const policyConformance = {
    required_domains_present: REQUIRED_DOMAINS.every((domain) => matrixRows.some((row) => row.domain === domain)),
    required_controls_mapped_to_jobs: !failures.some((f) => f.includes("not found in executed jobs") || f.includes("missing-matrix-entry")),
    required_controls_passed: failures.length === 0,
  };

  return {
    generated_at: new Date().toISOString(),
    workflow: workflowFile,
    run_id: String(runId),
    run_attempt: String(runAttempt),
    gate_results: gateResults,
    policy_conformance: policyConformance,
    skipped_waived_control_ledger: skippedWaivedLedger,
    failures,
  };
}

export { REQUIRED_DOMAINS };
