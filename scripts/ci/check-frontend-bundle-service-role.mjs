#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const appPath = 'apps/ValyntApp';
const sourcePath = `${appPath}/src`;
const sourceForbiddenIdentifiers = ['createServerSupabaseClient', 'createServiceRoleSupabaseClient', 'getSupabaseServerConfig'];
const bundleForbiddenIdentifiers = ['SUPABASE_SERVICE_ROLE_KEY', 'createServerSupabaseClient', 'createServiceRoleSupabaseClient'];
const bundlePrivateKeyPatterns = [
  { id: 'openai', regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { id: 'anthropic', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { id: 'google-api-key', regex: /\bAIza[0-9A-Za-z\-_]{20,}\b/g },
  { id: 'aws-access-key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: 'stripe-secret', regex: /\bsk_(?:test|live)_[0-9a-zA-Z]{20,}\b/g },
  { id: 'generic-secret-env-name', regex: /\b(?:OPENAI|TOGETHER|ANTHROPIC|STRIPE|SUPABASE_SERVICE_ROLE|PRIVATE|SECRET)_API_KEY\b/g },
];

function listFiles(pathExpression) {
  try {
    const files = execSync(`rg --files ${pathExpression}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    }).trim();

    return files.split('\n').filter(Boolean);
  } catch (error) {
    if (error?.status === 1) {
      return [];
    }

    throw error;
  }
}

function collectViolations(filePaths, forbiddenIdentifiers) {
  const violations = [];

  for (const relativePath of filePaths) {
    const absolutePath = join(process.cwd(), relativePath);
    const contents = readFileSync(absolutePath, 'utf8');

    for (const identifier of forbiddenIdentifiers) {
      if (contents.includes(identifier)) {
        violations.push(`${relativePath}: ${identifier}`);
      }
    }
  }

  return violations;
}

function collectPatternViolations(filePaths, patterns) {
  const violations = [];

  for (const relativePath of filePaths) {
    const absolutePath = join(process.cwd(), relativePath);
    const contents = readFileSync(absolutePath, 'utf8');

    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(contents)) {
        violations.push(`${relativePath}: ${pattern.id}`);
      }
    }
  }

  return violations;
}

const sourceViolations = collectViolations(listFiles(sourcePath), sourceForbiddenIdentifiers);

if (sourceViolations.length > 0) {
  console.error('❌ Privileged Supabase helpers found under frontend source paths:');
  for (const violation of sourceViolations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

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
const identifierViolations = collectViolations(artifactPaths, bundleForbiddenIdentifiers);
const keyPatternViolations = collectPatternViolations(artifactPaths, bundlePrivateKeyPatterns);

if (identifierViolations.length > 0 || keyPatternViolations.length > 0) {
  console.error('❌ Sensitive identifiers found in frontend build artifacts:');
  for (const violation of identifierViolations) {
    console.error(` - ${violation}`);
  }
  for (const violation of keyPatternViolations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log('✅ Frontend source and bundle inspection passed (no privileged helpers or private API key patterns found)');
