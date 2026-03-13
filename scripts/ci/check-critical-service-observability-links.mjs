#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const MATRIX_FILE = 'docs/observability/critical-service-reference-matrix.md';
const CRITICAL_PATH_PREFIXES = [
  'packages/backend/',
  'packages/memory/',
  'infra/observability/',
  'infra/k8s/observability/',
];

function getDiffRange() {
  if (process.env.OBSERVABILITY_POLICY_BASE) {
    return `${process.env.OBSERVABILITY_POLICY_BASE}...${process.env.OBSERVABILITY_POLICY_HEAD || 'HEAD'}`;
  }

  if (process.env.GITHUB_BASE_REF) {
    try {
      execSync(`git fetch --no-tags --depth=100 origin ${process.env.GITHUB_BASE_REF}`, { stdio: 'ignore' });
    } catch {
      // Ignore fetch failure in local/offline runs.
    }
    return `origin/${process.env.GITHUB_BASE_REF}...HEAD`;
  }

  try {
    execSync('git rev-parse --verify HEAD~1', { stdio: 'ignore' });
    return 'HEAD~1...HEAD';
  } catch {
    return '';
  }
}

function getChangedFiles(diffRange) {
  const command = diffRange ? `git diff --name-only ${diffRange}` : 'git ls-files';
  const output = execSync(command, { encoding: 'utf8' });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function validateMatrixFile() {
  if (!existsSync(MATRIX_FILE)) {
    throw new Error(`Missing required matrix file: ${MATRIX_FILE}`);
  }

  const content = readFileSync(MATRIX_FILE, 'utf8');
  const rows = content
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.includes('---'));

  const dataRows = rows.slice(1); // skip header row
  if (dataRows.length === 0) {
    throw new Error(`Matrix file ${MATRIX_FILE} must include at least one service row.`);
  }

  for (const row of dataRows) {
    const columns = row.split('|').map((col) => col.trim()).filter(Boolean);
    if (columns.length < 4) {
      throw new Error(`Invalid matrix row format: ${row}`);
    }

    const sloColumn = columns[2] ?? '';
    const runbookColumn = columns[3] ?? '';

    if (!/\[[^\]]+\]\(\.\/[^)]+\)/.test(sloColumn)) {
      throw new Error(`SLO reference must be a local markdown link in row: ${row}`);
    }

    if (!/\[[^\]]+\]\(\.\.\/[^)]+\)/.test(runbookColumn)) {
      throw new Error(`Runbook reference must be a docs-relative markdown link in row: ${row}`);
    }
  }
}

const diffRange = getDiffRange();
const changedFiles = getChangedFiles(diffRange);

const criticalChanges = changedFiles.filter((file) =>
  CRITICAL_PATH_PREFIXES.some((prefix) => file.startsWith(prefix)),
);

validateMatrixFile();

if (criticalChanges.length === 0) {
  console.log('✅ No critical service changes detected; observability link policy skipped.');
  process.exit(0);
}

if (!changedFiles.includes(MATRIX_FILE)) {
  console.error('❌ Critical service changes detected without matrix update.');
  console.error(`Update ${MATRIX_FILE} with linked SLO and runbook references.`);
  console.error('Changed critical files:');
  for (const file of criticalChanges) {
    console.error(` - ${file}`);
  }
  process.exit(1);
}

console.log('✅ Critical service observability link policy passed.');
console.log(`Validated ${criticalChanges.length} critical file change(s) with updated matrix references.`);
