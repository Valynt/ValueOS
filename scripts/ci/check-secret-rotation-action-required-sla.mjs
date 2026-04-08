#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOG_PATH = resolve('docs/security-compliance/secret-rotation-log.md');
const DEFAULT_SLA_HOURS = {
  critical: 24,
  high: 72,
  medium: 168,
  low: 336,
};

const content = readFileSync(LOG_PATH, 'utf8');
const headingRegex = /^###\s+(.+)$/gm;

function extractField(block, fieldName) {
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`- \\*\\*${escapedFieldName}:\\*\\*\\s*(.+)$`, 'im');
  const match = block.match(pattern);
  return match ? match[1].trim() : '';
}

function parseEntryDate(heading) {
  const dateMatch = heading.match(/^(\d{4}-\d{2}-\d{2})\b/);
  if (!dateMatch) {
    return null;
  }

  const parsed = new Date(`${dateMatch[1]}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }

  return parsed;
}

function resolveSlaHours(severity) {
  const envKey = `SECRET_ROTATION_SLA_HOURS_${severity.toUpperCase()}`;
  const overridden = process.env[envKey];
  if (overridden && overridden.trim()) {
    const parsed = Number.parseInt(overridden, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const defaultSla = DEFAULT_SLA_HOURS[severity];
  if (typeof defaultSla === 'number') {
    return defaultSla;
  }

  return 72;
}

const nowMs = Date.now();
const failures = [];
const inspected = [];

const headings = [...content.matchAll(headingRegex)];

for (let index = 0; index < headings.length; index += 1) {
  const heading = headings[index]?.[1]?.trim() ?? '';
  const blockStart = (headings[index]?.index ?? 0) + (headings[index]?.[0]?.length ?? 0);
  const blockEnd = headings[index + 1]?.index ?? content.length;
  const block = content.slice(blockStart, blockEnd);

  const status = extractField(block, 'Status').toLowerCase();
  if (!status.includes('action required')) {
    continue;
  }

  const isResolved = status.includes('rotated') || status.includes('false positive') || status.includes('closed');
  if (isResolved) {
    continue;
  }

  const severity = extractField(block, 'Severity').toLowerCase();
  const slaHours = resolveSlaHours(severity || 'high');

  const entryDate = parseEntryDate(heading);
  if (!entryDate) {
    failures.push(`${heading}: cannot determine incident date (expected heading prefix YYYY-MM-DD).`);
    continue;
  }

  const ageHours = (nowMs - entryDate.getTime()) / 3_600_000;
  if (ageHours < 0) {
    inspected.push(`${heading} (future-dated; skipped age enforcement)`);
    continue;
  }

  inspected.push(`${heading} (age=${ageHours.toFixed(1)}h, sla=${slaHours}h)`);

  if (ageHours > slaHours) {
    failures.push(
      `${heading}: unresolved ACTION REQUIRED incident age ${ageHours.toFixed(1)}h exceeds SLA ${slaHours}h (severity=${severity || 'unknown'}).`,
    );
  }
}

if (inspected.length === 0) {
  console.log('No unresolved ACTION REQUIRED incidents found in secret-rotation-log.md.');
  process.exit(0);
}

if (failures.length > 0) {
  console.error('Secret rotation SLA gate failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Secret rotation SLA gate passed for ${inspected.length} unresolved ACTION REQUIRED incident(s):`);
for (const detail of inspected) {
  console.log(`- ${detail}`);
}
