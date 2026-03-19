#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const WORKFLOW_DIR = '.github/workflows';
const MANIFEST_PATH = '.github/release-gate-manifest.json';

function resolveFromRoot(relativePath) {
  return resolve(ROOT, relativePath);
}

function read(relativePath) {
  return readFileSync(resolveFromRoot(relativePath), 'utf8');
}

function walk(relativeDir, predicate) {
  const results = [];
  const absoluteDir = resolveFromRoot(relativeDir);

  for (const entry of readdirSync(absoluteDir)) {
    const absolutePath = resolve(absoluteDir, entry);
    const relativePath = relative(ROOT, absolutePath);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      results.push(...walk(relativePath, predicate));
      continue;
    }

    if (predicate(relativePath)) {
      results.push(relativePath);
    }
  }

  return results.sort();
}

function stripWrappingQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function collectWorkflowJobs() {
  const workflowFiles = walk(WORKFLOW_DIR, (file) => /\.ya?ml$/u.test(file));
  const jobs = new Map();

  for (const file of workflowFiles) {
    const lines = read(file).split(/\r?\n/u);
    let inJobsBlock = false;
    let currentJobId = null;

    for (const line of lines) {
      if (!inJobsBlock) {
        if (line === 'jobs:') {
          inJobsBlock = true;
        }
        continue;
      }

      if (/^\S/u.test(line)) {
        inJobsBlock = false;
        currentJobId = null;
        continue;
      }

      const jobMatch = line.match(/^  ([A-Za-z0-9_-]+):\s*$/u);
      if (jobMatch) {
        currentJobId = jobMatch[1];
        if (!jobs.has(currentJobId)) {
          jobs.set(currentJobId, { file, jobId: currentJobId, jobName: null });
        }
        continue;
      }

      if (!currentJobId) {
        continue;
      }

      const nameMatch = line.match(/^    name:\s*(.+?)\s*$/u);
      if (nameMatch) {
        jobs.set(currentJobId, {
          file,
          jobId: currentJobId,
          jobName: stripWrappingQuotes(nameMatch[1].trim()),
        });
        currentJobId = null;
      }
    }
  }

  return jobs;
}

function extractBulletsUnderHeading(file, heading) {
  const lines = read(file).split(/\r?\n/u);
  const checks = [];
  let inSection = false;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();

    if (!inSection) {
      if (trimmed === heading) {
        inSection = true;
      }
      continue;
    }

    if (trimmed.startsWith('## ')) {
      break;
    }

    const bulletMatch = trimmed.match(/^- `([^`]+)`(?:\s+—.*)?$/u);
    if (bulletMatch) {
      checks.push(bulletMatch[1]);
    }
  }

  return checks;
}

function extractJobBlock(relativePath, jobId) {
  const lines = read(relativePath).split(/\r?\n/u);
  const startIndex = lines.findIndex((line) => line === `  ${jobId}:`);
  if (startIndex === -1) {
    return null;
  }

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/u.test(lines[index])) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex, endIndex).join('\n');
}

const manifest = JSON.parse(read(MANIFEST_PATH));
const workflowJobs = collectWorkflowJobs();
const failures = [];

if (!Array.isArray(manifest.requiredChecks) || manifest.requiredChecks.length === 0) {
  failures.push(`- ${MANIFEST_PATH} must define a non-empty requiredChecks array.`);
}

for (const check of manifest.requiredChecks ?? []) {
  const workflowJob = workflowJobs.get(check.jobId);
  if (!workflowJob) {
    failures.push(`- Manifest check \`${check.name}\` references missing jobId \`${check.jobId}\`.`);
    continue;
  }

  if (workflowJob.file !== check.workflow) {
    failures.push(
      `- Manifest check \`${check.name}\` expects workflow \`${check.workflow}\`, but jobId \`${check.jobId}\` lives in \`${workflowJob.file}\`.`,
    );
  }

  if (workflowJob.jobName !== check.name) {
    failures.push(
      `- Manifest check \`${check.name}\` expects jobId \`${check.jobId}\` to emit name \`${check.name}\`, but workflow emits \`${workflowJob.jobName}\`.`,
    );
  }
}

const docsHeading = manifest.productionDeploy?.docsHeading;
for (const docPath of manifest.productionDeploy?.docs ?? []) {
  const documentedChecks = extractBulletsUnderHeading(docPath, docsHeading);
  const manifestChecks = (manifest.requiredChecks ?? []).map((check) => check.name);

  if (documentedChecks.length === 0) {
    failures.push(`- ${docPath} must include a \`${docsHeading}\` section with bullet-listed check names.`);
    continue;
  }

  if (JSON.stringify(documentedChecks) !== JSON.stringify(manifestChecks)) {
    failures.push(
      `- ${docPath} \`${docsHeading}\` list does not exactly match ${MANIFEST_PATH}. Expected: ${manifestChecks.join(', ')}. Found: ${documentedChecks.join(', ')}.`,
    );
  }
}

const deployWorkflowPath = manifest.productionDeploy?.workflow;
const verifierJobId = manifest.productionDeploy?.verifierJobId;
const deployJobId = manifest.productionDeploy?.deployJobId;
const verifierJob = extractJobBlock(deployWorkflowPath, verifierJobId);
const deployJob = extractJobBlock(deployWorkflowPath, deployJobId);

if (!verifierJob) {
  failures.push(`- ${deployWorkflowPath} must define the verifier job \`${verifierJobId}\`.`);
} else {
  if (!verifierJob.includes(`name: ${manifest.productionDeploy.verifierJobName}`)) {
    failures.push(`- ${deployWorkflowPath} verifier job \`${verifierJobId}\` must emit name \`${manifest.productionDeploy.verifierJobName}\`.`);
  }

  if (!verifierJob.includes(MANIFEST_PATH)) {
    failures.push(`- ${deployWorkflowPath} verifier job \`${verifierJobId}\` must read ${MANIFEST_PATH}.`);
  }

  if (!verifierJob.includes('scripts/ci/verify-release-gate-check-runs.mjs')) {
    failures.push(`- ${deployWorkflowPath} verifier job \`${verifierJobId}\` must execute scripts/ci/verify-release-gate-check-runs.mjs.`);
  }
}

if (!deployJob) {
  failures.push(`- ${deployWorkflowPath} must define the production deploy job \`${deployJobId}\`.`);
} else {
  const hasVerifierNeed = deployJob.includes(`- ${verifierJobId}`) || deployJob.includes(`[${verifierJobId},`) || deployJob.includes(`, ${verifierJobId},`) || deployJob.includes(`, ${verifierJobId}]`) || deployJob.includes(`[${verifierJobId}]`);
  if (!hasVerifierNeed) {
    failures.push(`- ${deployWorkflowPath} job \`${deployJobId}\` must include \`${verifierJobId}\` in needs.`);
  }

  if (deployJob.includes('needs.quality-gate') || deployJob.includes('needs.dast-gate')) {
    failures.push(`- ${deployWorkflowPath} job \`${deployJobId}\` must gate on \`${verifierJobId}\`, not direct \`quality-gate\` or \`dast-gate\` results.`);
  }
}

if (failures.length > 0) {
  console.error('❌ Deploy workflow release-gate drift detected:');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `✅ Deploy workflow release-gate consistency verified (${manifest.requiredChecks.length} canonical checks, ${manifest.productionDeploy.docs.length} docs, verifier job ${verifierJobId})`,
);
