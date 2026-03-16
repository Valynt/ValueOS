#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

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
    id: 'ci-has-semgrep',
    file: '.github/workflows/ci.yml',
    test: (content) => content.includes('returntocorp/semgrep-action@v1'),
    error: 'Expected returntocorp/semgrep-action@v1 in .github/workflows/ci.yml',
  },
  {
    id: 'ci-has-trivy',
    file: '.github/workflows/ci.yml',
    test: (content) => content.includes('aquasecurity/trivy-action@0.28.0'),
    error: 'Expected aquasecurity/trivy-action@0.28.0 in .github/workflows/ci.yml',
  },
  {
    id: 'codeql-dedicated-workflow',
    file: '.github/workflows/codeql.yml',
    test: (content) =>
      content.includes('github/codeql-action/init@v3') &&
      content.includes('github/codeql-action/analyze@v3'),
    error: 'Expected dedicated CodeQL init/analyze steps in .github/workflows/codeql.yml',
  },
  {
    id: 'ci-has-tenant-controls-guard',
    file: '.github/workflows/ci.yml',
    test: (content) => content.includes('check-supabase-tenant-controls.mjs'),
    error: 'Expected check-supabase-tenant-controls.mjs in .github/workflows/ci.yml',
  },
];

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
