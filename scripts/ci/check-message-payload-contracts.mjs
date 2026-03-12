#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const producerFiles = [
  'packages/backend/src/services/billing/BillingSpendEvaluationService.ts',
];

const requiredFields = ['sender_id', 'recipient_ids', 'message_type'];
const tenantFieldRegex = /\btenant_id\b|\borganization_id\b/;
const legacyFieldRegex = /\bfrom_agent\b|\bto_agent\b|\bpriority\b/;

function getPublishPayloads(source) {
  const payloads = [];
  const regex = /publishMessage\(\s*['"`][^'"`]+['"`]\s*,\s*\{([\s\S]*?)\}\s*\)/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    payloads.push(match[1]);
  }
  return payloads;
}

const violations = [];

for (const file of producerFiles) {
  const source = await readFile(file, 'utf8');
  const payloads = getPublishPayloads(source);

  if (payloads.length === 0) {
    violations.push(`${file}: expected at least one publishMessage payload object`);
    continue;
  }

  for (const [index, payload] of payloads.entries()) {
    const missingFields = requiredFields.filter((field) => !new RegExp(`\\b${field}\\b`).test(payload));

    if (missingFields.length > 0) {
      violations.push(`${file}: publishMessage payload #${index + 1} missing required fields: ${missingFields.join(', ')}`);
    }

    if (!tenantFieldRegex.test(payload)) {
      violations.push(`${file}: publishMessage payload #${index + 1} missing tenant_id/organization_id`);
    }

    if (legacyFieldRegex.test(payload)) {
      violations.push(`${file}: publishMessage payload #${index + 1} contains legacy fields (from_agent/to_agent/priority)`);
    }
  }
}

if (violations.length > 0) {
  console.error('Message payload contract check failed:\n' + violations.join('\n'));
  process.exit(1);
}

console.log(`Message payload contract check passed for ${producerFiles.length} producer file(s).`);
