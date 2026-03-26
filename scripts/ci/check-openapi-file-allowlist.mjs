#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ALLOWLIST = new Set([
  'packages/backend/openapi.yaml',
  'archive/legacy-openapi/scripts-openapi.yaml'
]);

function listTrackedFiles() {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}

function isOpenApiYaml(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  const name = path.posix.basename(normalized).toLowerCase();
  return name.startsWith('openapi') && name.endsWith('.yaml');
}

function main() {
  const tracked = listTrackedFiles();
  const openApiFiles = tracked.filter((file) => existsSync(file) && isOpenApiYaml(file));

  const disallowed = openApiFiles.filter((file) => !ALLOWLIST.has(file));

  if (!ALLOWLIST.has('packages/backend/openapi.yaml')) {
    console.error('❌ OpenAPI allowlist is misconfigured: missing canonical path packages/backend/openapi.yaml.');
    process.exit(1);
  }

  if (disallowed.length > 0) {
    console.error('❌ OpenAPI path policy violation: found non-allowlisted openapi*.yaml files.');
    for (const file of disallowed) {
      console.error(`  - ${file}`);
    }
    console.error('Allowed paths:');
    for (const file of ALLOWLIST) {
      console.error(`  - ${file}`);
    }
    process.exit(1);
  }

  if (!openApiFiles.includes('packages/backend/openapi.yaml')) {
    console.error('❌ OpenAPI path policy violation: missing canonical file packages/backend/openapi.yaml.');
    process.exit(1);
  }

  console.log('✅ OpenAPI path policy check passed.');
}

main();
