#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const EXPECTED_PLATFORM = 'kubernetes';
const PLATFORM_MARKER = /active-runtime-platform:\s*([a-z0-9_-]+)/iu;
const REQUIRED_DOC_PHRASE = 'Kubernetes is the only active deploy target';

const files = [
  'infra/README.md',
  'DEPLOY.md',
  'docs/architecture/infrastructure-architecture.md',
  '.github/workflows/deploy-staging.yml',
  '.github/workflows/deploy-production.yml',
  '.github/workflows/dr-validation.yml',
  '.github/workflows/terraform.yml',
];

const failures = [];

for (const relativePath of files) {
  const content = readFileSync(resolve(ROOT, relativePath), 'utf8');
  const markerMatch = content.match(PLATFORM_MARKER);

  if (!markerMatch) {
    failures.push(`- ${relativePath} is missing an active-runtime-platform marker.`);
    continue;
  }

  const actualPlatform = markerMatch[1].toLowerCase();
  if (actualPlatform !== EXPECTED_PLATFORM) {
    failures.push(`- ${relativePath} declares active runtime platform '${actualPlatform}', expected '${EXPECTED_PLATFORM}'.`);
  }

  if (relativePath.endsWith('.md') && !content.includes(REQUIRED_DOC_PHRASE)) {
    failures.push(`- ${relativePath} must explicitly state: "${REQUIRED_DOC_PHRASE}".`);
  }
}

if (failures.length > 0) {
  console.error('❌ Runtime platform contract drift detected.');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`✅ Runtime platform contract verified (${files.length} files agree on '${EXPECTED_PLATFORM}').`);
