#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseControlPlaneMatrix, evaluateControlPlane } from "./control-plane-lib.mjs";

function readArg(flag) {
  const entry = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return entry ? entry.slice(flag.length + 1) : "";
}

const workflowFile = readArg("--workflow-file");
const matrixPath = readArg("--matrix-path") || ".github/workflows/CI_CONTROL_MATRIX.md";
const jobsPath = readArg("--jobs-json");
const outputPath = readArg("--output") || "artifacts/ops/control-plane-summary.json";
const runId = readArg("--run-id") || process.env.GITHUB_RUN_ID || "local";
const runAttempt = readArg("--run-attempt") || process.env.GITHUB_RUN_ATTEMPT || "1";

if (!workflowFile || !jobsPath) {
  console.error("Usage: node scripts/ci/generate-control-plane-summary.mjs --workflow-file=<file> --jobs-json=<path> [--output=<path>]");
  process.exit(1);
}

const jobs = JSON.parse(readFileSync(jobsPath, "utf8"));
const matrixRows = parseControlPlaneMatrix(matrixPath, workflowFile);
const summary = evaluateControlPlane({ matrixRows, jobs, workflowFile, runId, runAttempt });

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

if (summary.failures.length > 0) {
  console.error(`[control-plane-summary] Wrote ${outputPath} with failures.`);
  process.exit(1);
}

console.log(`[control-plane-summary] Wrote ${outputPath}.`);
