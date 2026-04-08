#!/usr/bin/env node

import fs from 'node:fs';

const args = process.argv.slice(2);
const requireReleaseManager = args.includes('--require-release-manager');
const expectedShaArg = args.find((arg) => arg.startsWith('--expected-sha='));
const expectedSha = expectedShaArg ? expectedShaArg.split('=')[1]?.trim() : '';

const docPath = 'docs/launch-readiness.md';
const content = fs.readFileSync(docPath, 'utf8');

const normalize = (value) => value.trim().toUpperCase();

function parseMarkdownTableRows(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start === -1) {
    throw new Error(`Missing required heading: ${heading}`);
  }

  const rest = markdown.slice(start + heading.length);
  const lines = rest.split('\n');

  const tableLines = [];
  let inTable = false;

  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      inTable = true;
      tableLines.push(line);
      continue;
    }

    if (inTable) {
      break;
    }
  }

  if (tableLines.length < 3) {
    throw new Error(`Could not parse table under heading: ${heading}`);
  }

  return tableLines.slice(2).filter((line) => line.trim().startsWith('|'));
}

const gateRows = parseMarkdownTableRows(content, '## Gate status dashboard');
const gateStatusById = new Map();
const gateSignoffById = new Map();

for (const row of gateRows) {
  const cols = row.split('|').map((cell) => cell.trim());
  const gateId = cols[1]?.match(/^G\d+/)?.[0];
  const statusRaw = cols[2] ?? '';
  const checkedCell = cols[5] ?? '';

  if (!gateId) {
    continue;
  }

  gateStatusById.set(gateId, normalize(statusRaw));
  gateSignoffById.set(gateId, /\[(x|X)\]/.test(checkedCell));
}

const violations = [];
for (const [gateId, status] of gateStatusById.entries()) {
  if (status !== 'COMPLETE') {
    continue;
  }

  if (!gateSignoffById.get(gateId)) {
    violations.push(`${gateId} is COMPLETE in gate dashboard but owner sign-off is unchecked.`);
  }
}

if (violations.length > 0) {
  console.error(`❌ ${docPath} gate/sign-off consistency check failed:`);
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

if (requireReleaseManager) {
  const decisionRows = parseMarkdownTableRows(content, '## Release manager decision');
  const row = decisionRows[0];
  const cols = row.split('|').map((cell) => cell.trim());
  const checkedCell = cols[1] ?? '';
  const timestamp = cols[2] ?? '';
  const releaseSha = cols[3] ?? '';

  const isChecked = /\[(x|X)\]/.test(checkedCell);

  if (!isChecked) {
    console.error('❌ Release Manager sign-off is required before production deploy.');
    process.exit(1);
  }

  const isoLike = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  if (!isoLike.test(timestamp)) {
    console.error('❌ Release Manager sign-off must include a UTC ISO timestamp (YYYY-MM-DDTHH:MM:SSZ).');
    process.exit(1);
  }

  if (!/^[a-fA-F0-9]{7,40}$/.test(releaseSha)) {
    console.error('❌ Release Manager sign-off must include a valid release SHA (7-40 hex chars).');
    process.exit(1);
  }

  if (expectedSha && releaseSha.toLowerCase() !== expectedSha.toLowerCase()) {
    console.error(`❌ Release Manager release SHA (${releaseSha}) does not match expected SHA (${expectedSha}).`);
    process.exit(1);
  }
}

console.log('✅ Launch readiness gate/sign-off consistency check passed.');
if (requireReleaseManager) {
  console.log('✅ Release Manager sign-off requirement satisfied.');
}
