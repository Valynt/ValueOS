#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

const classificationPath = resolve(
  root,
  "docs/security-compliance/evidence/hipaa/phi-classification-boundaries.json"
);
const workflowPath = resolve(
  root,
  "docs/security-compliance/evidence/hipaa/hipaa-gdpr-incident-workflows.json"
);

const failures = [];

function loadJson(path) {
  if (!existsSync(path)) {
    failures.push(`Missing artifact: ${path}`);
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`Failed to parse JSON at ${path}: ${error.message}`);
    return null;
  }
}

function requireArray(value, label, minLength = 1) {
  if (!Array.isArray(value) || value.length < minLength) {
    failures.push(`${label} must be an array with at least ${minLength} item(s).`);
    return false;
  }

  return true;
}

function requireFileReferences(paths, label) {
  for (const relativePath of paths) {
    const absolutePath = resolve(root, relativePath);
    if (!existsSync(absolutePath)) {
      failures.push(`${label} references a missing file: ${relativePath}`);
    }
  }
}

const classification = loadJson(classificationPath);
const workflows = loadJson(workflowPath);

if (classification) {
  requireArray(classification.classification, "classification.classification");
  requireArray(classification.access_boundaries, "classification.access_boundaries");

  for (const boundary of classification.access_boundaries ?? []) {
    if (!boundary.boundary_id) {
      failures.push("Each access boundary must define boundary_id.");
      continue;
    }

    if (requireArray(boundary.enforcement, `${boundary.boundary_id}.enforcement`)) {
      requireFileReferences(boundary.enforcement, `${boundary.boundary_id}.enforcement`);
    }

    requireArray(boundary.ci_checks, `${boundary.boundary_id}.ci_checks`);
  }
}

if (workflows) {
  if (requireArray(workflows.workflows, "workflows.workflows", 2)) {
    const ids = new Set(workflows.workflows.map((workflow) => workflow.workflow_id));

    for (const requiredId of [
      "hipaa-breach-gdpr-overlap",
      "data-subject-rights-and-accounting-overlap",
    ]) {
      if (!ids.has(requiredId)) {
        failures.push(`Missing required workflow definition: ${requiredId}`);
      }
    }

    for (const workflow of workflows.workflows) {
      if (!workflow.workflow_id) {
        failures.push("Each workflow must define workflow_id.");
        continue;
      }

      requireArray(workflow.steps, `${workflow.workflow_id}.steps`, 4);

      if (requireArray(workflow.evidence, `${workflow.workflow_id}.evidence`)) {
        requireFileReferences(workflow.evidence, `${workflow.workflow_id}.evidence`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("❌ HIPAA traceability artifacts check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("✅ HIPAA traceability artifacts verified.");
