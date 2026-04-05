#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const PLACEHOLDER_FILE_NAME_PATTERNS = [/^some-file\..+$/i, /^temp\..+$/i, /^scratch\..+$/i];
const PLACEHOLDER_FILE_CONTENTS = ['// Test change', '// Test change\n', '// Test change\r\n'];

const trackedFilesOutput = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
const trackedFiles = trackedFilesOutput.split('\0').filter(Boolean);

const violations = [];

for (const filePath of trackedFiles) {
  if (!existsSync(filePath)) {
    continue;
  }

  const fileName = basename(filePath);

  if (PLACEHOLDER_FILE_NAME_PATTERNS.some((pattern) => pattern.test(fileName))) {
    violations.push(`placeholder filename match: ${filePath}`);
  }

  let fileContents;
  try {
    fileContents = readFileSync(filePath, 'utf8');
  } catch {
    continue;
  }

  if (PLACEHOLDER_FILE_CONTENTS.includes(fileContents)) {
    violations.push(`placeholder file content match: ${filePath}`);
  }
}

if (violations.length > 0) {
  console.error('Repository hygiene check failed. Remove placeholder files/content:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Repository hygiene check passed (${trackedFiles.length} tracked files scanned).`);
