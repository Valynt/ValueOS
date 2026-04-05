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
const trackedOnly = args.includes('--tracked-only');
const baseSha = getArgValue('base-sha');
const headSha = getArgValue('head-sha') ?? 'HEAD';

const SOURCE_LIKE_DIR_PATTERN = /^packages\/[^/]+\/(src|lib|config|components)\//;
const GENERATED_EXT_PATTERN = /\.(js|js\.map|d\.ts\.map)$/;

const intentionalJsShims = new Set([
  // Add package-local JS runtime shims here when intentionally source-controlled.
]);

const resolveCandidateFiles = () => {
  const cmd = trackedOnly
    ? 'git ls-files'
    : stagedOnly
      ? 'git diff --cached --name-only --diff-filter=ACMR'
      : baseSha
        ? `git diff --name-only --diff-filter=ACMR ${baseSha}...${headSha}`
        : 'git ls-files';

  const output = execSync(cmd, { encoding: 'utf8' }).trim();
  if (!output) return [];
  return output.split('\n').filter(Boolean);
};

const stripGeneratedExt = (filePath) => {
  if (filePath.endsWith('.d.ts.map')) return filePath.slice(0, -'.d.ts.map'.length);
  if (filePath.endsWith('.js.map')) return filePath.slice(0, -'.js.map'.length);
  if (filePath.endsWith('.js')) return filePath.slice(0, -'.js'.length);
  return filePath;
};

const hasTsSourceEquivalent = (basePath) => {
  return ['.ts', '.tsx', '.mts', '.cts'].some((ext) => existsSync(`${basePath}${ext}`));
};

const isViolation = (filePath) => {
  if (!SOURCE_LIKE_DIR_PATTERN.test(filePath)) return false;
  if (!GENERATED_EXT_PATTERN.test(filePath)) return false;

  if (intentionalJsShims.has(filePath)) return false;

  const basePath = stripGeneratedExt(filePath);
  return hasTsSourceEquivalent(basePath);
};

const candidateFiles = resolveCandidateFiles();
const violations = candidateFiles.filter(isViolation).sort();

if (violations.length > 0) {
  console.error('❌ Generated artifacts with TypeScript sources are not allowed in packages/**/{src,lib,config,components}/**.');
  console.error('   Emit package builds to package-local dist/ directories only.');
  console.error('Offending files:');
  for (const file of violations) {
    console.error(`  - ${file}`);
  }
  process.exit(1);
}

console.log('✅ No tracked generated source-like artifacts detected.');
