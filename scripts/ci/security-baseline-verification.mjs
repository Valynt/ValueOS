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

const checks = [
  {
    id: 'headers-middleware-registered',
    file: 'packages/backend/src/server.ts',
    test: (content) => content.includes('app.use(securityHeadersMiddleware);'),
    error: 'Expected app.use(securityHeadersMiddleware); in packages/backend/src/server.ts',
  },
  {
    id: 'security-pack-enables-headers',
    file: 'packages/backend/src/middleware/security/index.ts',
    test: (content) =>
      content.includes('if (headersOptions.enabled !== false)') &&
      content.includes('createSecurityHeadersMiddleware'),
    error:
      'Expected security middleware pack to conditionally apply createSecurityHeadersMiddleware in packages/backend/src/middleware/security/index.ts',
  },
  {
    id: 'codeql-dedicated-workflow',
    file: '.github/workflows/codeql.yml',
    test: (content) =>
      toolManifest.scannerActions
        .filter(({ id }) => id === 'codeql-init' || id === 'codeql-analyze')
        .every(({ uses }) => content.includes(uses)),
    error: 'Expected CodeQL init/analyze refs from scripts/ci/security-tool-versions.json in .github/workflows/codeql.yml',
  },
  {
    id: 'ci-has-tenant-controls-guard',
    file: '.github/workflows/ci.yml',
    test: (content) => content.includes('check-supabase-tenant-controls.mjs'),
    error: 'Expected check-supabase-tenant-controls.mjs in .github/workflows/ci.yml',
  },
];

for (const scannerRef of toolManifest.ciWorkflowScannerRefs) {
  checks.push({
    id: `ci-has-${scannerRef}`,
    file: '.github/workflows/ci.yml',
    test: (content) => content.includes(scannerRef),
    error: `Expected ${scannerRef} in .github/workflows/ci.yml`,
  });
}

const failures = [];

for (const check of checks) {
  const content = read(check.file);
  if (!check.test(content)) {
    failures.push(`- [${check.id}] ${check.error}`);
  }
}

if (failures.length > 0) {
  console.error('❌ Security baseline verification failed:');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`✅ Security baseline verification passed (${checks.length} checks)`);
