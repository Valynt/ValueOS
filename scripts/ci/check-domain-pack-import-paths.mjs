#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const scanRoot = path.join(repoRoot, 'packages/backend/src');

const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const ALLOWED_SHIM_PREFIXES = [];

const LEGACY_IMPORT_PATTERN = /from\s+['"][^'"]*domainPacks(?:\/[^'"]*)?['"]|import\s*\(\s*['"][^'"]*domainPacks(?:\/[^'"]*)?['"]\s*\)/;

function walk(dir, files) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
}

if (!fs.existsSync(scanRoot)) {
  console.error(`Expected backend source root to exist: ${scanRoot}`);
  process.exit(1);
}

const files = [];
walk(scanRoot, files);

const violations = [];

for (const file of files) {
  const relative = path.relative(repoRoot, file).replaceAll('\\', '/');
  if (ALLOWED_SHIM_PREFIXES.some((prefix) => relative === prefix || relative.startsWith(prefix))) {
    continue;
  }

  const source = fs.readFileSync(file, 'utf8');
  if (LEGACY_IMPORT_PATTERN.test(source)) {
    violations.push(relative);
  }
}

if (violations.length > 0) {
  console.error('Legacy camelCase domain-pack import paths detected.');
  console.error('Use canonical `domain-packs` module roots instead.');
  console.error('');
  for (const violation of violations.sort()) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Domain-pack import path guard passed (no legacy `domainPacks` imports outside shims).');
