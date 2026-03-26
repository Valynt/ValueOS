#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const policyPath = resolve(ROOT, 'config/security/browser-key-policy.json');

const sensitiveKeyPattern = /^(VITE_)?(?:OPENAI|TOGETHER|ANTHROPIC|COHERE|GROQ|MISTRAL|STRIPE_SECRET|STRIPE_SK|SERVICE_ROLE|PRIVATE|SECRET|AWS|AZURE|GCP|SUPABASE_SERVICE_ROLE|DATABASE|JWT)[A-Z0-9_]*$/;
const parsedArgs = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value ?? 'true'];
}));
const appFilter = parsedArgs.app;

function listFrontendFiles() {
  const globs = [
    'apps/*/src/**/*.{ts,tsx,js,jsx,mjs,cjs}',
    'apps/*/client/src/**/*.{ts,tsx,js,jsx,mjs,cjs}',
  ];

  try {
    const output = execSync(`rg --files ${globs.map((glob) => `-g '${glob}'`).join(' ')}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    }).trim();

    const files = output ? output.split('\n').filter(Boolean) : [];
    if (!appFilter) {
      return files;
    }

    return files.filter((file) => file.startsWith(`apps/${appFilter}/`));
  } catch (error) {
    if (error?.status === 1) {
      return [];
    }

    console.error('❌ Failed to enumerate frontend source files for key governance checks');
    console.error(error?.stderr?.toString?.() || error?.message || String(error));
    process.exit(1);
  }
}

function findViteApiKeyUsages(files) {
  const findings = [];
  const usageRegex = /import\.meta\.env\.(VITE_[A-Z0-9_]*_API_KEY)\b/g;

  for (const file of files) {
    const contents = readFileSync(resolve(ROOT, file), 'utf8');
    const lines = contents.split('\n');

    for (let index = 0; index < lines.length; index += 1) {
      usageRegex.lastIndex = 0;
      const line = lines[index];
      let match = usageRegex.exec(line);

      while (match) {
        findings.push({
          file,
          line: index + 1,
          keyName: match[1],
        });
        match = usageRegex.exec(line);
      }
    }
  }

  return findings;
}

function loadPolicy() {
  const raw = readFileSync(policyPath, 'utf8');
  return JSON.parse(raw);
}

function isExactOrigin(origin) {
  return /^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(origin) && !origin.includes('*');
}

const files = listFrontendFiles();
const usages = findViteApiKeyUsages(files);
const policy = loadPolicy();
const rules = policy?.keys ?? {};
const errors = [];

for (const usage of usages) {
  const rule = rules[usage.keyName];
  if (!rule) {
    errors.push(`${usage.file}:${usage.line} uses ${usage.keyName} but no policy entry exists in config/security/browser-key-policy.json`);
    continue;
  }

  if (rule.classification === 'secret-misuse') {
    errors.push(`${usage.file}:${usage.line} uses ${usage.keyName} classified as secret-misuse; this key must not be exposed via VITE_`);
    continue;
  }

  if (rule.classification !== 'public-key-safe') {
    errors.push(`${usage.keyName} has invalid classification \"${rule.classification}\" (expected public-key-safe or secret-misuse)`);
  }

  if (!Array.isArray(rule.allowedOrigins) || rule.allowedOrigins.length === 0) {
    errors.push(`${usage.keyName} must define non-empty allowedOrigins`);
  } else {
    for (const origin of rule.allowedOrigins) {
      if (!isExactOrigin(origin)) {
        errors.push(`${usage.keyName} contains non-exact allowed origin: ${origin}`);
      }
    }
  }

  if (!Array.isArray(rule.allowedEndpoints) || rule.allowedEndpoints.length === 0) {
    errors.push(`${usage.keyName} must define non-empty allowedEndpoints`);
  }

  if (!rule.quotas || typeof rule.quotas.perMinute !== 'number' || typeof rule.quotas.perDay !== 'number') {
    errors.push(`${usage.keyName} must define quotas.perMinute and quotas.perDay numbers`);
  }

  if (!Array.isArray(rule.anomalyAlerts) || rule.anomalyAlerts.length === 0) {
    errors.push(`${usage.keyName} must define anomalyAlerts`);
  }
}

for (const envKey of Object.keys(process.env)) {
  if (!envKey.startsWith('VITE_')) {
    continue;
  }

  const nonPrefixed = envKey.replace(/^VITE_/, '');
  if (sensitiveKeyPattern.test(nonPrefixed)) {
    errors.push(`Sensitive env var ${envKey} is incorrectly prefixed with VITE_ and would be exposed to browser bundles`);
  }
}

for (const policyKey of Object.keys(rules)) {
  const nonPrefixed = policyKey.replace(/^VITE_/, '');
  if (sensitiveKeyPattern.test(nonPrefixed)) {
    errors.push(`Policy key ${policyKey} appears sensitive and must not use VITE_ prefix`);
  }
}

if (errors.length > 0) {
  console.error('❌ Browser API key governance validation failed:\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`✅ Browser API key governance checks passed (${usages.length} usage(s) validated)`);
