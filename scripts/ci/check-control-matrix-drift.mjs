#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { parseControlPlaneMatrix, evaluateControlPlane } from "./control-plane-lib.mjs";

function readArg(flag) {
  const entry = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return entry ? entry.slice(flag.length + 1) : "";
}

const workflowFile = readArg("--workflow-file");
const matrixPath = readArg("--matrix-path") || ".github/workflows/CI_CONTROL_MATRIX.md";
const jobsPath = readArg("--jobs-json");
const runId = readArg("--run-id") || process.env.GITHUB_RUN_ID || "local";
const runAttempt = readArg("--run-attempt") || process.env.GITHUB_RUN_ATTEMPT || "1";

if (!workflowFile || !jobsPath) {
  console.error("Usage: node scripts/ci/check-control-matrix-drift.mjs --workflow-file=<file> --jobs-json=<path> [--matrix-path=<path>]");
  process.exit(1);
}

const jobs = JSON.parse(readFileSync(jobsPath, "utf8"));
const matrixRows = parseControlPlaneMatrix(matrixPath, workflowFile);
const summary = evaluateControlPlane({ matrixRows, jobs, workflowFile, runId, runAttempt });

if (summary.failures.length > 0) {
  console.error("[control-matrix-drift] FAIL");
  for (const failure of summary.failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`[control-matrix-drift] PASS: ${workflowFile} control matrix is aligned with executed gates.`);
