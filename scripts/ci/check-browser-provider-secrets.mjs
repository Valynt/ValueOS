#!/usr/bin/env node
import { execSync } from 'node:child_process';

const forbiddenEnvVars = [
  'VITE_TOGETHER_API_KEY',
  'VITE_OPENAI_API_KEY',
  'VITE_OPENAI_SECRET_KEY',
  'VITE_STRIPE_SECRET_KEY',
  'VITE_STRIPE_SK_TEST',
  'VITE_STRIPE_SK_LIVE',
];

const browserCodeGlobs = [
  'apps/**/src/**/*.{ts,tsx,js,jsx,mjs,cjs,html}',
  'packages/**/src/**/*.{ts,tsx,js,jsx,mjs,cjs,html}',
];

const pattern = `import\\.meta\\.env\\.(${forbiddenEnvVars.join('|')})`;
const globArgs = browserCodeGlobs.map((glob) => `-g '${glob}'`).join(' ');
const command = `rg -n --pcre2 "${pattern}" ${globArgs}`;

try {
  const output = execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  }).trim();

  if (output) {
    console.error('❌ Forbidden provider secret env vars detected in browser code:');
    console.error(output);
    process.exit(1);
  }
} catch (error) {
  const status = error?.status;

  if (status === 1) {
    // ripgrep exits 1 when no matches are found.
    console.log('✅ Browser provider secret env var check passed');
    process.exit(0);
  }

  console.error('❌ Browser provider secret env var check failed to execute');
  console.error(error?.stderr?.toString?.() || error?.message || String(error));
  process.exit(1);
}

console.log('✅ Browser provider secret env var check passed');
