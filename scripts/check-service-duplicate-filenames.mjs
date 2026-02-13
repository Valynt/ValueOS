#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'apps/ValyntApp/src/services');
const backendRoot = path.join(repoRoot, 'packages/backend/src/services');
const baselinePath = path.join(repoRoot, 'config/service-duplicate-baseline.json');

const EXCLUDED_DIRS = new Set(['__tests__', '__benchmarks__']);

function collectTsFiles(dir) {
  const files = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        walk(path.join(currentDir, entry.name));
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        files.push(path.join(currentDir, entry.name));
      }
    }
  }

  walk(dir);
  return files;
}

function basenameSet(files) {
  return new Set(files.map((file) => path.basename(file)));
}

const baselineDuplicates = new Set(JSON.parse(fs.readFileSync(baselinePath, 'utf8')));
const appFiles = collectTsFiles(appRoot);
const backendFiles = collectTsFiles(backendRoot);

const appNames = basenameSet(appFiles);
const backendNames = basenameSet(backendFiles);
const currentDuplicates = [...appNames].filter((name) => backendNames.has(name)).sort();
const newDuplicates = currentDuplicates.filter((name) => !baselineDuplicates.has(name));

if (newDuplicates.length > 0) {
  console.error('❌ New duplicate service filenames detected between apps/ValyntApp and packages/backend:\n');
  for (const name of newDuplicates) {
    console.error(`  - ${name}`);
  }
  console.error('\nResolve by migrating app imports to @backend/* and avoiding new app-local backend-domain service files.');
  process.exit(1);
}

console.log(`✅ Duplicate filename guard passed. Current duplicates: ${currentDuplicates.length}. New duplicates: 0.`);
