#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const runbookFile = 'docs/runbooks/alert-runbooks.md';
const runbookPath = path.resolve(repoRoot, runbookFile);

const markdown = await readFile(runbookPath, 'utf8');
const errors = [];

if (!markdown.includes('## Status')) {
  errors.push('Missing section: "Status".');
}

const pendingMatches = [...markdown.matchAll(/\|\s*([^|]+?)\s*\|\s*\[\s*\]\s*pending\s*\|/gim)];
if (pendingMatches.length > 0) {
  for (const match of pendingMatches) {
    errors.push(`Runbook still pending for alert: ${match[1].trim()}`);
  }
}

if (errors.length > 0) {
  console.error(`❌ Alert runbook check failed for ${runbookFile}.`);
  for (const error of errors) {
    console.error(` - ${error}`);
  }
  process.exit(1);
}

console.log(`✅ Alert runbook check passed for ${runbookFile}.`);
console.log('No pending alerts found in the runbook status table.');
