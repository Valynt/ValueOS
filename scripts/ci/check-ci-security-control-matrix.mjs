#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const MATRIX_PATH = '.github/workflows/CI_CONTROL_MATRIX.md';
const REQUIRED_CONTROLS = [
  'Lint',
  'Typecheck',
  'Unit',
  'Integration',
  'RLS',
  'DAST',
  'SAST',
  'SBOM',
  'Accessibility',
  'i18n',
  'Terraform',
];

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function parseMarkdownTable(markdown, heading) {
  const sectionPattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?:\\n## |$)`);
  const match = markdown.match(sectionPattern);
  if (!match) {
    throw new Error(`Missing section \"## ${heading}\" in ${MATRIX_PATH}`);
  }

  const tableLines = match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'));

  if (tableLines.length < 3) {
    throw new Error(`Section \"## ${heading}\" must contain a markdown table in ${MATRIX_PATH}`);
  }

  const headers = tableLines[0].split('|').slice(1, -1).map((cell) => cell.trim());
  return tableLines.slice(2).map((line) => {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

function stripCode(value) {
  return value.replace(/`/g, '').trim();
}

function listWorkflowJobs(relativePath) {
  const workflowPath = `.github/workflows/${relativePath}`;
  const absolutePath = resolve(ROOT, workflowPath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Primary owner workflow not found: ${workflowPath}`);
  }

  const content = read(workflowPath);
  const jobsStart = content.indexOf('\njobs:\n');
  if (jobsStart === -1) {
    throw new Error(`Workflow ${workflowPath} does not declare a jobs: section.`);
  }

  const jobSection = content.slice(jobsStart + 6);
  const jobs = Array.from(jobSection.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)).map((match) => match[1]);
  return new Set(jobs);
}

function ensurePrimaryOwners(rows, failures) {
  for (const control of REQUIRED_CONTROLS) {
    const matches = rows.filter((row) => row.Control === control);
    if (matches.length !== 1) {
      failures.push(`- Control \"${control}\" must appear exactly once in ${MATRIX_PATH}; found ${matches.length}.`);
      continue;
    }

    const row = matches[0];
    const workflowName = stripCode(row['Primary owner workflow']);
    const jobName = stripCode(row['Primary owner job']);

    if (!workflowName || !jobName) {
      failures.push(`- Control \"${control}\" must declare both a primary owner workflow and job.`);
      continue;
    }

    try {
      const jobs = listWorkflowJobs(workflowName);
      if (!jobs.has(jobName)) {
        failures.push(`- Control \"${control}\" points to missing job \"${jobName}\" in .github/workflows/${workflowName}.`);
      }
    } catch (error) {
      failures.push(`- ${error.message}`);
    }
  }
}

function ensureWorkflowLifecycle(rows, failures) {
  const seen = new Set();
  for (const row of rows) {
    const workflow = stripCode(row.Workflow);
    if (!workflow) {
      failures.push(`- Workflow lifecycle rows must include a workflow name in ${MATRIX_PATH}.`);
      continue;
    }
    if (seen.has(workflow)) {
      failures.push(`- Workflow lifecycle contains duplicate entry for ${workflow} in ${MATRIX_PATH}.`);
    }
    seen.add(workflow);
  }
}

function ensureScannerActions(failures) {
  const toolManifest = JSON.parse(read('scripts/ci/security-tool-versions.json'));
  for (const { workflow, uses } of toolManifest.scannerActions) {
    const content = read(workflow);
    if (!content.includes(uses)) {
      failures.push(`- Missing required scanner action \`${uses}\` in ${workflow}.`);
    }
  }
}

const failures = [];
const matrixDoc = read(MATRIX_PATH);
const controlRows = parseMarkdownTable(matrixDoc, 'Primary Control Owners');
const lifecycleRows = parseMarkdownTable(matrixDoc, 'Workflow Lifecycle');

ensurePrimaryOwners(controlRows, failures);
ensureWorkflowLifecycle(lifecycleRows, failures);
ensureScannerActions(failures);

if (failures.length > 0) {
  console.error('❌ CI control matrix drift detected:');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`✅ CI control matrix verified (${REQUIRED_CONTROLS.length} controls, ${lifecycleRows.length} workflow lifecycle entries).`);
