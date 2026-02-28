#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const appPath = 'apps/ValyntApp';
const forbiddenIdentifiers = ['SUPABASE_SERVICE_ROLE_KEY', 'createServerSupabaseClient'];

try {
  execSync('npm_config_engine_strict=false pnpm --filter valynt-app build', {
    stdio: 'inherit',
    shell: true,
  });
} catch (error) {
  console.error('❌ Failed to build ValyntApp before bundle inspection');
  process.exit(error?.status ?? 1);
}

let files = '';
try {
  files = execSync(`rg --files ${appPath}/dist`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  }).trim();
} catch (error) {
  if (error?.status === 1) {
    console.error('❌ No frontend build artifacts found for ValyntApp');
    process.exit(1);
  }
  console.error('❌ Failed to list frontend build artifacts');
  console.error(error?.stderr?.toString?.() || error?.message || String(error));
  process.exit(1);
}

const artifactPaths = files.split('\n').filter(Boolean);
const violations = [];

for (const relativePath of artifactPaths) {
  const absolutePath = join(process.cwd(), relativePath);
  const contents = readFileSync(absolutePath, 'utf8');
  for (const identifier of forbiddenIdentifiers) {
    if (contents.includes(identifier)) {
      violations.push(`${relativePath}: ${identifier}`);
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Service-role identifiers found in frontend build artifacts:');
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log('✅ Frontend bundle inspection passed (no service-role identifiers found)');
