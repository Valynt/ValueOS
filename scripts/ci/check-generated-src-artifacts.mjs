#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const getArgValue = (name) => {
  const pref = `--${name}=`;
  const found = args.find((arg) => arg.startsWith(pref));
  return found ? found.slice(pref.length) : undefined;
};

const stagedOnly = args.includes('--staged');
const baseSha = getArgValue('base-sha');
const headSha = getArgValue('head-sha') ?? 'HEAD';

const allowedDts = new Set([
  'apps/ValyntApp/src/vite-env.d.ts',
  'apps/ValyntApp/src/types/external-modules.d.ts',
  'apps/ValyntApp/src/types/opossum.d.ts',
  'apps/VOSAcademy/src/types/modules.d.ts',
  'packages/backend/src/types/express.d.ts',
  'packages/backend/src/types/external-modules.d.ts',
  'packages/backend/src/lib/observability/observability.d.ts',
  'packages/backend/src/vite-env.d.ts',
  'packages/shared/src/vite-env.d.ts',
]);

const generatedExtPattern = /\.(js|js\.map|d\.ts|d\.ts\.map)$/;
const resolveChangedFiles = () => {
  const cmd = stagedOnly
    ? 'git diff --cached --name-only --diff-filter=ACMR'
    : baseSha
      ? `git diff --name-only --diff-filter=ACMR ${baseSha}...${headSha}`
      : 'git ls-files';

  const output = execSync(cmd, { encoding: 'utf8' }).trim();
  if (!output) return [];
  return output.split('\n').filter(Boolean);
};

const isViolation = (filePath) => {
  if (!generatedExtPattern.test(filePath)) return false;
  if (!filePath.includes('/src/')) return false;
  if (!filePath.startsWith('packages/')) return false;

  if (filePath.endsWith('.d.ts') && allowedDts.has(filePath)) {
    return false;
  }

  if (filePath.endsWith('.d.ts')) {
    const base = filePath.slice(0, -'.d.ts'.length);
    if (!existsSync(`${base}.ts`) && !existsSync(`${base}.tsx`) && !existsSync(`${base}.mts`) && !existsSync(`${base}.cts`)) {
      return false;
    }
  }

  return true;
};

const changedFiles = resolveChangedFiles();
const violations = changedFiles.filter(isViolation);

if (violations.length > 0) {
  console.error('❌ Generated artifacts are not allowed under packages/**/src/**. Emit build outputs to dist/ instead.');
  console.error('Offending files:');
  for (const file of violations) {
    console.error(`  - ${file}`);
  }
  process.exit(1);
}

console.log('✅ No generated src artifacts detected in scoped files.');
