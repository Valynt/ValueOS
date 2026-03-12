#!/usr/bin/env node

/**
 * CI guard: assert no *.test.ts files exist at the root of a runtime service directory.
 *
 * Correctly placed tests live in:
 *   packages/backend/src/runtime/<service>/__tests__/*.test.ts
 *
 * Root-level test files (e.g. execution-runtime/execution-runtime.test.ts) are
 * not picked up consistently by all vitest configs and create ambiguity about
 * which test suite owns the coverage. (R4 naming rule — test-strategy.md)
 *
 * Exit 0: all runtime tests are correctly placed.
 * Exit 1: one or more violations found.
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const RUNTIME_ROOT = path.join(ROOT, 'packages/backend/src/runtime');

if (!existsSync(RUNTIME_ROOT)) {
  console.error(`❌ Runtime root not found: ${RUNTIME_ROOT}`);
  console.error('   Check that packages/backend/src/runtime exists.');
  process.exit(1);
}

const violations = [];

console.log(`Checking runtime test placement in: packages/backend/src/runtime...`);

let serviceEntries;
try {
  serviceEntries = readdirSync(RUNTIME_ROOT);
} catch (err) {
  console.error(`❌ Failed to read runtime root: ${err.message}`);
  process.exit(1);
}

for (const service of serviceEntries) {
  const servicePath = path.join(RUNTIME_ROOT, service);

  let isDir;
  try {
    isDir = statSync(servicePath).isDirectory();
  } catch {
    // Skip entries that can't be stat'd (e.g. broken symlinks).
    continue;
  }

  if (!isDir) continue;

  let children;
  try {
    children = readdirSync(servicePath);
  } catch {
    continue;
  }

  for (const child of children) {
    // Only flag files directly in the service root — not inside __tests__/ or
    // any other subdirectory.
    if (!child.endsWith('.test.ts')) continue;

    const childPath = path.join(servicePath, child);

    let childIsFile;
    try {
      childIsFile = !statSync(childPath).isDirectory();
    } catch {
      continue;
    }

    if (childIsFile) {
      violations.push(path.relative(ROOT, childPath));
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Naming Convention Violation (R4): root-level test files in runtime service directories.');
  console.error('   Move these files to a "__tests__/" subdirectory:\n');
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  console.error('\n   See docs/engineering/test-strategy.md — R4 Consolidation.');
  process.exit(1);
}

console.log(`✅ All runtime tests are correctly placed.`);
