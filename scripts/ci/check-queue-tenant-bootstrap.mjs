#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const failures = [];

const tenantAwareQueueHandlers = [
  'packages/backend/src/workers/researchWorker.ts',
  'packages/backend/src/workers/crmWorker.ts',
  'packages/backend/src/workers/ArtifactGenerationWorker.ts',
  'packages/backend/src/workers/CertificateGenerationWorker.ts',
  'packages/backend/src/workers/WebhookRetryWorker.ts',
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

  const bootstrapsTenantContext =
    /runJobWithTenantContext\(|tenantContextStorage\.run\(/.test(source);
  if (!bootstrapsTenantContext) {
    failures.push(`${rel}: tenant-aware queue handler missing tenant-context bootstrap`);
  }
}

if (failures.length > 0) {
  console.error('Queue tenant bootstrap check FAILED');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log(`Queue tenant bootstrap check PASS (${tenantAwareQueueHandlers.length} files scanned)`);
