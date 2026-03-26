#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const TARGET_ROOTS = [
  'packages/backend/src/services/realtime',
  'packages/backend/src/workers',
];

const APPROVED_FILES = new Set([
  'packages/backend/src/services/realtime/MessageBus.ts',
  'packages/backend/src/services/realtime/EventProducer.ts',
  'packages/backend/src/services/realtime/EventConsumer.ts',
  'packages/backend/src/services/realtime/MessageQueue.ts',
  'packages/backend/src/workers/researchWorker.ts',
  'packages/backend/src/workers/crmWorker.ts',
  'packages/backend/src/workers/ArtifactGenerationWorker.ts',
  'packages/backend/src/workers/CertificateGenerationWorker.ts',
]);

const EVENTING_PRIMITIVE_PATTERNS = [
  /\bnew\s+Queue\s*(?:<[^>]+>)?\s*\(/g,
  /\bnew\s+Worker\s*(?:<[^>]+>)?\s*\(/g,
  /\.(?:producer|consumer)\s*\(/g,
  /\bjetstream(?:Manager)?\s*\(/g,
  /\bcreateEventConsumer\s*\(/g,
  /\bgetEventProducer\s*\(/g,
];

const ADR_OR_REFERENCE_TAG_PATTERN = /(ADR-\d{4}|EVENTING_REF\s*:)/;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function findPrimitiveMatches(content) {
  const matches = [];
  for (const pattern of EVENTING_PRIMITIVE_PATTERNS) {
    let result;
    while ((result = pattern.exec(content)) !== null) {
      matches.push({ index: result.index, token: result[0] });
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

function toLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

const violations = [];

for (const root of TARGET_ROOTS) {
  const files = await walk(root);
  for (const file of files) {
    const relativeFilePath = file.split(path.sep).join('/');
    const content = await readFile(file, 'utf8');

    const matches = findPrimitiveMatches(content);
    if (matches.length === 0) {
      continue;
    }

    if (APPROVED_FILES.has(relativeFilePath)) {
      continue;
    }

    if (ADR_OR_REFERENCE_TAG_PATTERN.test(content)) {
      continue;
    }

    const first = matches[0];
    violations.push(
      `${relativeFilePath}:${toLineNumber(content, first.index)} uses eventing primitive "${first.token.trim()}" outside the approved matrix and is missing ADR/reference tag (expected ADR-XXXX or EVENTING_REF: ...)`,
    );
  }
}

if (violations.length > 0) {
  console.error('Eventing architecture guard failed.');
  console.error('Add ADR-XXXX or EVENTING_REF: tag comments when introducing new producer/consumer patterns outside approved modules.');
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('Eventing architecture guard passed.');
