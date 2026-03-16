#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

const requiredScannerActions = [
  {
    file: '.github/workflows/ci.yml',
    action: 'gitleaks/gitleaks-action@v2',
  },
  {
    file: '.github/workflows/ci.yml',
    action: 'returntocorp/semgrep-action@v1',
  },
  {
    file: '.github/workflows/ci.yml',
    action: 'aquasecurity/trivy-action@0.28.0',
  },
  {
    file: '.github/workflows/codeql.yml',
    action: 'github/codeql-action/init@v3',
  },
  {
    file: '.github/workflows/codeql.yml',
    action: 'github/codeql-action/analyze@v3',
  },
];

const failures = [];

for (const { file, action } of requiredScannerActions) {
  const content = read(file);
  if (!content.includes(action)) {
    failures.push(`- Missing required scanner action \`${action}\` in ${file}`);
  }
}

const matrixDoc = read('.github/workflows/CI_CONTROL_MATRIX.md');
const requiredControlRows = [
  'CodeQL (JavaScript/TypeScript)',
  'Trivy filesystem + container image scanning',
  'Gitleaks secret scanning',
  'Semgrep SAST scanning',
];

for (const row of requiredControlRows) {
  if (!matrixDoc.includes(row)) {
    failures.push(`- Missing control matrix row containing \`${row}\` in .github/workflows/CI_CONTROL_MATRIX.md`);
  }
}

if (failures.length > 0) {
  console.error('❌ CI security control matrix drift detected:');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`✅ CI security control matrix verified (${requiredScannerActions.length} action checks, ${requiredControlRows.length} matrix rows)`);
