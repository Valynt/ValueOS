#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const runbookFile = 'docs/runbooks/alert-runbooks.md';
const runbookPath = path.resolve(repoRoot, runbookFile);

const markdown = await readFile(runbookPath, 'utf8');
const pendingMatches = markdown.match(/^\|\s*[^|]+\|\s*\[ \]\s*pending\s*\|.*$/gim) ?? [];

if (pendingMatches.length > 0) {
  console.error(`❌ Alert runbook check failed for ${runbookFile}.`);
  console.error('The following alert rows are still marked as pending:');
  for (const row of pendingMatches) {
    console.error(` - ${row.trim()}`);
  }
  process.exit(1);
}

console.log(`✅ Alert runbook check passed for ${runbookFile}.`);
