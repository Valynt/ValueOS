#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const servicesRoot = path.join(repoRoot, 'apps/ValyntApp/src/services');
const baselinePath = path.join(repoRoot, 'config/valynt-app-services-freeze-baseline.json');

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const baselineFiles = new Set(baseline.baselineFiles);
const allowedNewPrefixes = baseline.allowedNewPrefixes ?? [];

const EXCLUDED_DIRS = new Set(['__tests__']);

function collectServiceFiles() {
  const files = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        walk(path.join(currentDir, entry.name));
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        files.push(path.relative(servicesRoot, path.join(currentDir, entry.name)).replace(/\\/g, '/'));
      }
    }
  }

  walk(servicesRoot);
  return files;
}

const currentFiles = collectServiceFiles();
const disallowedNewFiles = currentFiles
  .filter((file) => !baselineFiles.has(file))
  .filter((file) => !allowedNewPrefixes.some((prefix) => file.startsWith(prefix)))
  .sort();

if (disallowedNewFiles.length > 0) {
  console.error('❌ New files under apps/ValyntApp/src/services are frozen unless UI-only adapters:');
  for (const file of disallowedNewFiles) {
    console.error(`  - ${file}`);
  }
  console.error('\nIf this is a UI-only adapter, place it under apps/ValyntApp/src/services/ui-adapters/.');
  process.exit(1);
}

console.log(`✅ ValyntApp service freeze guard passed. Tracked baseline files: ${baselineFiles.size}.`);
