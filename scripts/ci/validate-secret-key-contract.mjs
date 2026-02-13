#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const BASE_EXTERNAL_SECRETS = resolve(ROOT, 'infra/k8s/base/external-secrets.yaml');
const OVERLAY_PATCHES = [
  resolve(ROOT, 'infra/k8s/overlays/production/external-secrets-vault-patch.yaml'),
  resolve(ROOT, 'infra/k8s/overlays/production/external-secrets-aws-patch.yaml'),
  resolve(ROOT, 'infra/k8s/overlays/staging/external-secrets-aws-patch.yaml'),
];
const ENV_FILES = [
  resolve(ROOT, '.env.example'),
  resolve(ROOT, 'scripts/config/environments/base.env'),
  resolve(ROOT, 'scripts/config/environments/development.env'),
  resolve(ROOT, 'scripts/config/environments/staging.env'),
  resolve(ROOT, 'scripts/config/environments/production.env'),
  resolve(ROOT, 'scripts/config/environments/test.env'),
];

const REQUIRED_SECRET_KEYS = [
  'database-url',
  'supabase-url',
  'supabase-anon-key',
  'supabase-service-key',
  'together-api-key',
  'openai-api-key',
  'jwt-secret',
  'session-secret',
];

const SECRET_TO_ENV = {
  'database-url': 'DATABASE_URL',
  'supabase-url': 'SUPABASE_URL',
  'supabase-anon-key': 'SUPABASE_ANON_KEY',
  'supabase-service-key': 'SUPABASE_SERVICE_ROLE_KEY',
  'together-api-key': 'TOGETHER_API_KEY',
  'openai-api-key': 'OPENAI_API_KEY',
  'jwt-secret': 'JWT_SECRET',
  'session-secret': 'SESSION_SECRET',
};

const failures = [];

const read = (path) => readFileSync(path, 'utf8');

function collectNamespaceKeys(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  const byNamespace = new Map();
  let inExternalSecret = false;
  let currentNamespace = null;

  for (const line of lines) {
    if (/^kind:\s+ExternalSecret\s*$/.test(line)) {
      inExternalSecret = true;
      currentNamespace = null;
      continue;
    }

    if (/^---\s*$/.test(line)) {
      inExternalSecret = false;
      currentNamespace = null;
      continue;
    }

    if (!inExternalSecret) continue;

    const ns = line.match(/^\s*namespace:\s*([a-z0-9-]+)\s*$/);
    if (ns) {
      currentNamespace = ns[1];
      if (!byNamespace.has(currentNamespace)) byNamespace.set(currentNamespace, new Set());
      continue;
    }

    const key = line.match(/^\s*-\s+secretKey:\s*([a-z0-9-_]+)\s*$/);
    if (key && currentNamespace) {
      byNamespace.get(currentNamespace).add(key[1]);
    }
  }

  return byNamespace;
}

function validateKebabCase(keys, context) {
  for (const key of keys) {
    if (!/^[a-z0-9-]+$/.test(key)) {
      failures.push(`${context}: key "${key}" is not kebab-case.`);
    }
  }
}

const baseYaml = read(BASE_EXTERNAL_SECRETS);
const byNamespace = collectNamespaceKeys(baseYaml);

if (byNamespace.size === 0) {
  failures.push('No ExternalSecret namespaces were parsed from infra/k8s/base/external-secrets.yaml.');
}

for (const [namespace, keySet] of byNamespace.entries()) {
  validateKebabCase(keySet, `Namespace ${namespace}`);

  for (const required of REQUIRED_SECRET_KEYS) {
    if (!keySet.has(required)) {
      failures.push(`Namespace ${namespace} is missing required secretKey "${required}".`);
    }
  }

  if (keySet.size !== REQUIRED_SECRET_KEYS.length) {
    const extras = [...keySet].filter((k) => !REQUIRED_SECRET_KEYS.includes(k));
    if (extras.length > 0) {
      failures.push(`Namespace ${namespace} has unexpected secret keys: ${extras.join(', ')}.`);
    }
  }
}

for (const patchPath of OVERLAY_PATCHES) {
  const content = read(patchPath);
  const secretKeyMatches = [...content.matchAll(/secretKey:\s*([a-z0-9-_]+)/g)].map((m) => m[1]);
  validateKebabCase(secretKeyMatches, `Overlay patch ${patchPath.replace(`${ROOT}/`, '')}`);
}

for (const envFile of ENV_FILES) {
  const content = read(envFile);
  const relPath = envFile.replace(`${ROOT}/`, '');

  for (const envVar of Object.values(SECRET_TO_ENV)) {
    const re = new RegExp(`^${envVar}=`, 'm');
    if (!re.test(content)) {
      failures.push(`${relPath} is missing ${envVar} (mapped from k8s secrets).`);
    }
  }

  if (/^SUPABASE_SERVICE_KEY=/m.test(content)) {
    failures.push(`${relPath} uses deprecated SUPABASE_SERVICE_KEY; use SUPABASE_SERVICE_ROLE_KEY.`);
  }
}

if (failures.length > 0) {
  console.error('❌ Secret key contract validation failed:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log('✅ Secret key contract validation passed.');
