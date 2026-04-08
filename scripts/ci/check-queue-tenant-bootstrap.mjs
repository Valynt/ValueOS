#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const failures = [];

const CONTEXT_RESTORING_PATTERNS = /runJobWithTenantContext\(|tenantContextStorage\.run\(/;
const UNSAFE_CROSS_TENANT_PATTERNS = /tenantContextStorage\.getStore\(|CacheService|getTenantLogContext|runJobWithTenantContext\(|tenantContextStorage\.run\(/;
const WORKER_CLASSIFICATION_PATTERN = /WORKER_CLASSIFICATION:\s*(tenant-context-restored|explicit-cross-tenant-safe)/g;

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const tenantAwareQueueHandlers = [
  'packages/backend/src/workers/researchWorker.ts',
  'packages/backend/src/workers/crmWorker.ts',
  'packages/backend/src/workers/ArtifactGenerationWorker.ts',
  'packages/backend/src/workers/CertificateGenerationWorker.ts',
  'packages/backend/src/workers/WebhookRetryWorker.ts',
  'packages/backend/src/workers/mcpIntegrationWorker.ts',
  'packages/backend/src/services/agents/AgentMessageQueue.ts',
  'packages/backend/src/services/realtime/MessageQueue.ts',
  'packages/backend/src/services/metering/UsageQueueConsumerWorker.ts',
];

for (const rel of tenantAwareQueueHandlers) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    failures.push(`${rel}: file not found`);
    continue;
  }

  const source = readFileSync(abs, 'utf8');
  const usesTenantField = /tenantId|tenant_id|organizationId|organization_id/.test(source);
  const hasQueueHandler = /new\s+Worker<|for\s+await\s*\(const\s+message\s+of\s+subscription\)/.test(source);
  if (!usesTenantField || !hasQueueHandler) {
    continue;
  }

  const bootstrapsTenantContext = CONTEXT_RESTORING_PATTERNS.test(source);
  if (!bootstrapsTenantContext) {
    failures.push(`${rel}: tenant-aware queue handler missing tenant-context bootstrap`);
  }
}

function listWorkerFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listWorkerFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

const workersRoot = join(ROOT, 'packages/backend/src/workers');
const workerFiles = listWorkerFiles(workersRoot);
let scannedWorkersWithBullmq = 0;

for (const abs of workerFiles) {
  const source = readFileSync(abs, 'utf8');
  const rel = relative(ROOT, abs).replaceAll('\\\\', '/');
  const uncommentedSource = stripComments(source);
  const hasBullmqWorkerImport = /from\s+['"`]bullmq['"`]/.test(uncommentedSource) && /\bWorker\b/.test(uncommentedSource);
  const workerConstructors = uncommentedSource.match(/new\s+Worker\s*\(/g) ?? [];

  if (!hasBullmqWorkerImport || workerConstructors.length === 0) {
    continue;
  }

  scannedWorkersWithBullmq += workerConstructors.length;

  const classifications = [...source.matchAll(WORKER_CLASSIFICATION_PATTERN)].map((m) => m[1]);
  if (classifications.length !== workerConstructors.length) {
    failures.push(
      `${rel}: expected ${workerConstructors.length} WORKER_CLASSIFICATION markers but found ${classifications.length}`,
    );
    continue;
  }

  for (const classification of classifications) {
    if (classification === 'tenant-context-restored' && !CONTEXT_RESTORING_PATTERNS.test(source)) {
      failures.push(`${rel}: marked tenant-context-restored but does not establish ALS tenant context`);
    }

    if (classification === 'explicit-cross-tenant-safe' && UNSAFE_CROSS_TENANT_PATTERNS.test(source)) {
      failures.push(
        `${rel}: marked explicit-cross-tenant-safe but calls tenant-context-dependent helpers or restores tenant ALS`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Queue tenant bootstrap check FAILED');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Queue tenant bootstrap check PASS (${tenantAwareQueueHandlers.length} tenant-aware files + ${scannedWorkersWithBullmq} BullMQ workers scanned)`,
);
