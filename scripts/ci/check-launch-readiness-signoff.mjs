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

const gateRows = parseMarkdownTableRows(content, '## Gate evidence matrix');
const gateStatusById = new Map();

for (const row of gateRows) {
  const cols = row.split('|').map((cell) => cell.trim());
  const gateId = cols[1]?.match(/^G\d+/)?.[0];
  const statusRaw = cols[2] ?? '';

  if (!gateId) {
    continue;
  }

  gateStatusById.set(gateId, normalize(statusRaw));
}

const signoffRows = parseMarkdownTableRows(content, '## Go/No-Go sign-off table');
const signoffById = new Map();
let releaseManagerRow = null;

for (const row of signoffRows) {
  const cols = row.split('|').map((cell) => cell.trim());
  const roleCell = cols[1] ?? '';
  const checkedCell = cols[2] ?? '';
  const timestamp = cols[3] ?? '';
  const releaseSha = cols[4] ?? '';

  const gateId = roleCell.match(/^G\d+/)?.[0];
  const isChecked = /\[(x|X)\]/.test(checkedCell);

  if (gateId) {
    signoffById.set(gateId, { isChecked, timestamp, releaseSha, roleCell });
  }

  if (roleCell.startsWith('Release Manager')) {
    releaseManagerRow = { isChecked, timestamp, releaseSha, roleCell };
  }
}

const violations = [];
for (const [gateId, status] of gateStatusById.entries()) {
  if (status !== 'COMPLETE') {
    continue;
  }

  const signoff = signoffById.get(gateId);
  if (!signoff || !signoff.isChecked) {
    violations.push(`${gateId} is COMPLETE in gate matrix but unchecked in sign-off table.`);
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
  if (!releaseManagerRow) {
    console.error(`❌ ${docPath} is missing the Release Manager sign-off row.`);
    process.exit(1);
  }

  if (!releaseManagerRow.isChecked) {
    console.error('❌ Release Manager sign-off is required before production deploy.');
    process.exit(1);
  }

  const isoLike = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  if (!isoLike.test(releaseManagerRow.timestamp)) {
    console.error('❌ Release Manager sign-off must include a UTC ISO timestamp (YYYY-MM-DDTHH:MM:SSZ).');
    process.exit(1);
  }

  if (!/^[a-fA-F0-9]{7,40}$/.test(releaseManagerRow.releaseSha)) {
    console.error('❌ Release Manager sign-off must include a valid release SHA (7-40 hex chars).');
    process.exit(1);
  }

  if (expectedSha && releaseManagerRow.releaseSha.toLowerCase() !== expectedSha.toLowerCase()) {
    console.error(
      `❌ Release Manager release SHA (${releaseManagerRow.releaseSha}) does not match expected SHA (${expectedSha}).`
    );
    process.exit(1);
  }
}

console.log('✅ Launch readiness gate/sign-off consistency check passed.');
if (requireReleaseManager) {
  console.log('✅ Release Manager sign-off requirement satisfied.');
}
