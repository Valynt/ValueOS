#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function readToolManifest() {
  return JSON.parse(read('scripts/ci/security-tool-versions.json'));
}

const toolManifest = readToolManifest();
const requiredScannerActions = toolManifest.scannerActions
  .filter(({ uses }) => uses)
  .map(({ workflow, uses }) => ({ file: workflow, action: uses }));
const requiredCliScans = toolManifest.scannerActions
  .filter(({ script }) => script);

const failures = [];

for (const { file, action } of requiredScannerActions) {
  const content = read(file);
  if (!content.includes(action)) {
    failures.push(`- Missing required scanner action \`${action}\` in ${file}`);
  }
}

for (const { workflow, script, mode, version } of requiredCliScans) {
  if (!read(workflow).includes(`bash ${script} ${mode} `)) {
    failures.push(`- Missing CLI secret scanner invocation in ${workflow}: ${script} ${mode}`);
  }
  if (!read(script).includes(`GITLEAKS_VERSION="${version}"`)) {
    failures.push(`- CLI secret scanner version mismatch in ${script}: ${version}`);
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
