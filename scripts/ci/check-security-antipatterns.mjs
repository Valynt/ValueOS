#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
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
].filter((f, i, arr) => arr.indexOf(f) === i && existsSync(resolve(ROOT, f)));

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

// ─── dangerouslySetInnerHTML allowlist (SEC-002) ─────────────────────────────
// Only the files below may use dangerouslySetInnerHTML. Any other file that
// introduces it must be added to this list after a security review.
const DANGEROUS_HTML_ALLOWLIST = new Set([
  'apps/ValyntApp/src/components/security/SafeHtml.tsx',
  'eslint.config.js',
  'packages/sdui/src/security/sanitization.ts',
]);

function listSourceFiles() {
  try {
    const output = execSync(
      "rg --files -g '*.tsx' -g '*.ts' -g '*.jsx' -g '*.js' " +
        "--glob '!**/__tests__/**' --glob '!**/*.test.*' --glob '!**/*.spec.*' " +
        "--glob '!**/node_modules/**' --glob '!**/dist/**'",
      { cwd: ROOT, encoding: 'utf8' }
    ).trim();
    return output ? output.split('\n') : [];
  } catch (err) {
    // rg (ripgrep) is required for the dangerouslySetInnerHTML allowlist check.
    // Fail loudly rather than silently skipping the gate.
    console.error('❌ listSourceFiles: ripgrep (rg) is required but failed to run.');
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

for (const file of listSourceFiles()) {
  const absPath = resolve(ROOT, file);
  if (!existsSync(absPath)) continue;
  const content = readFileSync(absPath, 'utf8');
  if (!content.includes('dangerouslySetInnerHTML')) continue;

  // Normalise to forward-slash relative path for allowlist comparison
  const relPath = file.replace(/\\/g, '/');
  if (!DANGEROUS_HTML_ALLOWLIST.has(relPath)) {
    findings.push({
      file,
      line: 0,
      rule: 'unapproved-dangerous-html',
      message:
        'dangerouslySetInnerHTML used outside the approved allowlist. ' +
        'Route rich HTML through SafeHtml.tsx or add this file to DANGEROUS_HTML_ALLOWLIST ' +
        'in scripts/ci/check-security-antipatterns.mjs after security review.',
    });
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
