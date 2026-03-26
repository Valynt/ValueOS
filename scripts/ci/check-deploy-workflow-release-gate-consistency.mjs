#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci/release-gate-manifest.json'), 'utf8'));
const workflowPath = manifest.deployWorkflow.workflowPath;
const deployWorkflow = readFileSync(resolve(ROOT, workflowPath), 'utf8');

function extractJobBlock(jobId) {
  const startMarker = `  ${jobId}:\n`;
  const start = deployWorkflow.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Job \`${jobId}\` was not found in ${workflowPath}.`);
  }
  const rest = deployWorkflow.slice(start + startMarker.length);
  const nextJob = rest.search(/\n  [A-Za-z0-9_-]+:\n/);
  const body = nextJob === -1 ? rest : rest.slice(0, nextJob);
  return `${startMarker}${body}`;
}

function extractInlineNeeds(jobBlock, jobId) {
  const match = jobBlock.match(/needs:\s*\[([^\]]+)\]/);
  if (!match) {
    throw new Error(`Job \`${jobId}\` must declare an inline needs array.`);
  }

  return match[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

const failures = [];
const aggregateJobId = manifest.deployWorkflow.aggregateJobId;
const aggregateJobBlock = extractJobBlock(aggregateJobId);
const aggregateNeeds = extractInlineNeeds(aggregateJobBlock, aggregateJobId);
const productionJobBlock = extractJobBlock('deploy-production');
const productionNeeds = extractInlineNeeds(productionJobBlock, 'deploy-production');

const aggregateNameLine = aggregateJobBlock.match(/\n    name:\s*(.+)/);
if (!aggregateNameLine || !aggregateNameLine[1].includes(manifest.deployWorkflow.aggregateJobName)) {
  failures.push(
    `- ${aggregateJobId} must keep the exact display name \`${manifest.deployWorkflow.aggregateJobName}\` so documentation and audit references stay aligned.`,
  );
}

for (const localNeed of manifest.deployWorkflow.localNeeds) {
  if (!aggregateNeeds.includes(localNeed)) {
    failures.push(`- ${aggregateJobId} must depend on local gate job \`${localNeed}\`.`);
  }
}

for (const requiredNeed of manifest.deployWorkflow.productionNeedsMustInclude) {
  if (!productionNeeds.includes(requiredNeed)) {
    failures.push(`- deploy-production must depend on \`${requiredNeed}\` per scripts/ci/release-gate-manifest.json.`);
  }
}

for (const forbiddenNeed of manifest.deployWorkflow.productionNeedsMustExclude) {
  if (productionNeeds.includes(forbiddenNeed)) {
    failures.push(`- deploy-production must not depend on \`${forbiddenNeed}\`; it should consume the canonical aggregate gate instead.`);
  }
}

if (!/needs\.release-gate-contract\.result == 'success'/.test(deployWorkflow)) {
  failures.push("- deploy-production must explicitly require needs.release-gate-contract.result == 'success' in its if/precondition guard.");
}

if (!/node scripts\/ci\/verify-release-gate-status\.mjs/.test(aggregateJobBlock)) {
  failures.push(`- ${aggregateJobId} must evaluate the canonical release gate manifest via scripts/ci/verify-release-gate-status.mjs.`);
}

if (failures.length > 0) {
  console.error('❌ Deploy workflow release-gate drift detected:');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('✅ Deploy workflow release-gate consistency verified.');
