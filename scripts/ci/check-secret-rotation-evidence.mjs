#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOG_PATH = resolve('docs/security-compliance/secret-rotation-log.md');

const content = readFileSync(LOG_PATH, 'utf8');
const headingRegex = /^###\s+(.+)$/gm;

const failures = [];
const inspected = [];

function extractField(block, fieldName) {
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`- \\*\\*${escapedFieldName}:\\*\\*\\s*(.+)$`, 'im');
  const match = block.match(pattern);
  return match ? match[1].trim() : '';
}

function hasTicketReference(value) {
  return /(INC|SEC|OPS|PLAT|JIRA)-\d+/i.test(value) || /issues\/\d+/i.test(value);
}

function hasOperatorLogReference(value) {
  return /actions\/runs\//i.test(value) || /artifacts\//i.test(value) || /workflow artifacts/i.test(value) || /operator-log/i.test(value);
}

function hasIsoTimestamp(value) {
  return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z)?/.test(value);
}

const headings = [...content.matchAll(headingRegex)];

for (let index = 0; index < headings.length; index += 1) {
  const heading = headings[index]?.[1]?.trim() ?? '';
  const blockStart = (headings[index]?.index ?? 0) + (headings[index]?.[0]?.length ?? 0);
  const blockEnd = headings[index + 1]?.index ?? content.length;
  const block = content.slice(blockStart, blockEnd);

  const severity = extractField(block, 'Severity').toLowerCase();
  const status = extractField(block, 'Status').toLowerCase();

  if (severity !== 'critical') {
    continue;
  }

  const isOpen = !status.includes('rotated') && !status.includes('false positive') && !status.includes('closed');
  if (!isOpen) {
    continue;
  }

  inspected.push(heading);

  const evidenceTicket = extractField(block, 'Evidence ticket');
  const operatorLog = extractField(block, 'Operator log');
  const evidenceTimestamp = extractField(block, 'Evidence timestamp (UTC)');

  if (!evidenceTicket || !hasTicketReference(evidenceTicket)) {
    failures.push(`${heading}: missing valid **Evidence ticket** (expected e.g. SEC-1234 or issue link).`);
  }

  if (!operatorLog || !hasOperatorLogReference(operatorLog)) {
    failures.push(`${heading}: missing valid **Operator log** (expected workflow run/artifact reference).`);
  }

  if (!evidenceTimestamp || !hasIsoTimestamp(evidenceTimestamp)) {
    failures.push(`${heading}: missing valid **Evidence timestamp (UTC)** in ISO-8601 Z format.`);
  }
}

if (inspected.length === 0) {
  console.log('No open critical secret incidents found in secret-rotation-log.md.');
  process.exit(0);
}

if (failures.length > 0) {
  console.error('Secret rotation evidence gate failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Secret rotation evidence gate passed for ${inspected.length} open critical incident(s):`);
for (const heading of inspected) {
  console.log(`- ${heading}`);
}
