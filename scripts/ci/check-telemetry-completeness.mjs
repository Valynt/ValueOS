#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const policyPath = path.resolve(repoRoot, 'config/observability-policy.json');
const policy = JSON.parse(await readFile(policyPath, 'utf8'));

const requiredTags = policy.required_tags ?? ['service', 'env', 'tenant_id', 'trace_id'];
const sampling = policy.trace_sampling ?? {};

const targetFiles = [
  'packages/backend/src/observability/telemetryStandards.ts',
  'packages/backend/src/runtime/decision-router/index.ts',
  'packages/backend/src/runtime/policy-engine/index.ts',
  'packages/backend/src/runtime/context-store/index.ts',
  'packages/backend/src/runtime/recommendation-engine/RecommendationEngine.ts',
  'packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts',
  'apps/ValyntApp/src/lib/observability.ts',
  'apps/ValyntApp/src/app/bootstrap/init.ts',
];

const errors = [];
for (const rel of targetFiles) {
  const content = await readFile(path.resolve(repoRoot, rel), 'utf8');
  for (const tag of requiredTags) {
    if (!content.includes(tag)) {
      errors.push(`${rel} is missing required telemetry tag literal: ${tag}`);
    }
  }
}

for (const [env, ratio] of Object.entries(sampling)) {
  if (typeof ratio !== 'number' || Number.isNaN(ratio) || ratio <= 0 || ratio > 1) {
    errors.push(`Invalid sampling ratio for ${env}: ${String(ratio)} (must be > 0 and <= 1)`);
  }
}

if (errors.length) {
  console.error('❌ Telemetry completeness check failed.');
  for (const error of errors) {
    console.error(` - ${error}`);
  }
  process.exit(1);
}

console.log('✅ Telemetry completeness check passed.');
console.log(`Validated ${targetFiles.length} files and ${Object.keys(sampling).length} sampling policies.`);
