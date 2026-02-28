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

function runRgCheck({ title, pattern, globs }) {
  const globArgs = globs.map((glob) => `-g '${glob}'`).join(' ');
  const command = `rg -n --pcre2 "${pattern}" ${globArgs}`;

  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    }).trim();

    if (output) {
      console.error(`❌ ${title}`);
      console.error(output);
      process.exit(1);
    }
  } catch (error) {
    const status = error?.status;
    if (status === 1) {
      return;
    }

    console.error(`❌ ${title} check failed to execute`);
    console.error(error?.stderr?.toString?.() || error?.message || String(error));
    process.exit(1);
  }
}

runRgCheck({
  title: 'Forbidden provider secret env vars detected in browser code',
  pattern: `import\\.meta\\.env\\.(${forbiddenEnvVars.join('|')})`,
  globs: browserCodeGlobs,
});

runRgCheck({
  title: 'Server/service-role modules must not be imported from apps/**',
  pattern:
    String.raw`^\s*import\s+[^\n]*from\s+['\"](?:@shared/lib/supabase|@backend/[^'\"]*supabase|(?:\.\./)+packages/backend/src/lib/supabase(?:\.js)?)['\"]`,
  globs: ['apps/**/*.{ts,tsx,js,jsx,mjs,cjs}'],
});

console.log('✅ Browser provider secret env var + service-role import checks passed');
