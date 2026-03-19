#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const targetGlobs = [
  'apps/ValyntApp/src/**/*.{ts,tsx,js,jsx,mjs,cjs}',
  '!apps/ValyntApp/src/**/*.test.{ts,tsx,js,jsx,mjs,cjs}',
  '!apps/ValyntApp/src/**/__tests__/**',
  '!apps/ValyntApp/src/**/*.stories.{ts,tsx,js,jsx,mjs,cjs}',
];

const checks = [
  {
    title: 'SUPABASE_SERVICE_ROLE_KEY must not appear in ValyntApp source',
    pattern: 'SUPABASE_SERVICE_ROLE_KEY',
  },
  {
    title: 'Direct fs imports are forbidden in ValyntApp source',
    pattern: String.raw`(?:from\s+['"](?:node:)?fs['"]|require\(['"](?:node:)?fs['"]\))`,
    pcre2: true,
  },
  {
    title: 'node-vault must not appear in ValyntApp source',
    pattern: 'node-vault',
  },
  {
    title: '@aws-sdk/client-secrets-manager must not appear in ValyntApp source',
    pattern: '@aws-sdk/client-secrets-manager',
  },
  {
    title: 'Non-VITE process.env access is forbidden in ValyntApp source',
    pattern: String.raw`process\.env\.(?!VITE_)[A-Z0-9_]+`,
    pcre2: true,
  },
];

function runCheck({ title, pattern, pcre2 = false }) {
  const args = ['-n'];
  if (pcre2) {
    args.push('--pcre2');
  }
  args.push(pattern, ...targetGlobs.flatMap((glob) => ['-g', glob]));

  const result = spawnSync('rg', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status === 1) {
    return;
  }

  if (result.status !== 0) {
    console.error(`❌ ${title} check failed to execute`);
    console.error(result.stderr || result.stdout || `rg exited with status ${result.status}`);
    process.exit(1);
  }

  const output = result.stdout.trim();
  if (output) {
    console.error(`❌ ${title}`);
    console.error(output);
    process.exit(1);
  }
}

for (const check of checks) {
  runCheck(check);
}

console.log('✅ ValyntApp server-boundary guard passed');
