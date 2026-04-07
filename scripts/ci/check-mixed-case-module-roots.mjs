#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const scanRoot = path.join(repoRoot, 'packages/backend/src');

const allowedMixedCaseRoots = new Set([]);

function walkDirectories(dir, collector) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const childDirs = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'));

  const byLowercase = new Map();
  for (const entry of childDirs) {
    const key = entry.name.toLowerCase().replace(/[-_]/g, '');
    const existing = byLowercase.get(key) ?? [];
    existing.push(entry.name);
    byLowercase.set(key, existing);
  }

  for (const [, names] of byLowercase.entries()) {
    const unique = [...new Set(names)].sort();
    if (unique.length > 1) {
      const relativeParent = path.relative(repoRoot, dir).replaceAll('\\', '/');
      collector.push(`${relativeParent}::${unique.join('|')}`);
    }
  }

  for (const child of childDirs) {
    walkDirectories(path.join(dir, child.name), collector);
  }
}

if (!fs.existsSync(scanRoot)) {
  console.error(`Expected scan root to exist: ${scanRoot}`);
  process.exit(1);
}

const discovered = [];
walkDirectories(scanRoot, discovered);

const unexpected = discovered.filter((entry) => !allowedMixedCaseRoots.has(entry));
const missingAllowlisted = [...allowedMixedCaseRoots].filter((entry) => !discovered.includes(entry));

if (unexpected.length > 0 || missingAllowlisted.length > 0) {
  console.error('Mixed-case duplicate module root guard failed.');

  if (unexpected.length > 0) {
    console.error('\nUnexpected mixed-case duplicates:');
    for (const entry of unexpected) {
      console.error(`- ${entry}`);
    }
  }

  if (missingAllowlisted.length > 0) {
    console.error('\nAllowlist drift detected (remove stale entries or restore migration shims):');
    for (const entry of missingAllowlisted) {
      console.error(`- ${entry}`);
    }
  }

  process.exit(1);
}

console.log('Mixed-case duplicate module root guard passed.');
for (const entry of discovered) {
  console.log(`- allowlisted: ${entry}`);
}
