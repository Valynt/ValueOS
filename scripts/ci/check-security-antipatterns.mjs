#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');

function listFiles(glob) {
  try {
    const output = execSync(`rg --files -g '${glob}'`, { cwd: ROOT, encoding: 'utf8' }).trim();
    return output ? output.split('\n') : [];
  } catch {
    return [];
  }
}

const dockerfiles = [
  ...listFiles('.devcontainer/**/Dockerfile'),
  ...listFiles('.devcontainer/**/Dockerfile.*'),
  '.devcontainer/Dockerfile.dev',
].filter((f, i, arr) => arr.indexOf(f) === i);

const composeFiles = [
  ...listFiles('.devcontainer/**/docker-compose*.yml'),
  ...listFiles('ops/compose/**/*.yml'),
  ...listFiles('docker-compose*.yml'),
].filter((f) => !f.includes('node_modules/') && !f.startsWith('infra/') && !f.startsWith('scripts/'));

const findings = [];

const dockerRules = [
  {
    id: 'remote-install-pipe-shell',
    regex: /\bcurl\b[^\n|]*\|\s*(?:bash|sh)\b|\bwget\b[^\n|]*\|\s*(?:bash|sh)\b/i,
    message: 'Disallow remote installer piping to shell (curl|bash / wget|sh).',
  },
  {
    id: 'latest-node-tag',
    regex: /FROM\s+node:(latest|\d+)(?:\s|$)/i,
    message: 'Disallow unpinned Node base image tags such as node:latest or major-only tags.',
  },
];

const composeRules = [
  {
    id: 'default-credential-fallback',
    regex: /\$\{(?:POSTGRES_PASSWORD|REDIS_PASSWORD|JWT_SECRET|ANON_KEY|SERVICE_ROLE_KEY|SUPABASE_SERVICE_KEY)[^}]*:-[^}]+\}/g,
    message: 'Disallow weak/default credential fallback values in compose files.',
  },
  {
    id: 'obvious-placeholder-secret',
    regex: /(your-super-secret|changeme|dev_password|password123|example-secret)/i,
    message: 'Disallow obvious placeholder secrets in compose files.',
  },
];

for (const file of dockerfiles) {
  const content = readFileSync(resolve(ROOT, file), 'utf8');
  for (const rule of dockerRules) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (rule.regex.test(lines[i])) {
        findings.push({ file, line: i + 1, rule: rule.id, message: rule.message });
      }
    }
  }
}

for (const file of composeFiles) {
  const content = readFileSync(resolve(ROOT, file), 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    for (const rule of composeRules) {
      rule.regex.lastIndex = 0;
      if (rule.regex.test(lines[i])) {
        findings.push({ file, line: i + 1, rule: rule.id, message: rule.message });
      }
    }
  }
}

if (findings.length > 0) {
  console.error('❌ Security anti-pattern checks failed:\n');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
  }
  process.exit(1);
}

console.log('✅ Security anti-pattern checks passed');
