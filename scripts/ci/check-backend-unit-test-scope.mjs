#!/usr/bin/env node

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const BACKEND_SRC_ROOT = path.join(ROOT, 'packages/backend/src');
const BACKEND_VITEST_CONFIG = path.join(ROOT, 'packages/backend/vitest.config.ts');

const isVitestCandidate = (relativePath) => relativePath.endsWith('.test.ts') || relativePath.endsWith('.spec.ts');

const walkFiles = (currentDirectory, results = []) => {
  for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
    const fullPath = path.join(currentDirectory, entry.name);

    if (entry.isDirectory()) {
      walkFiles(fullPath, results);
      continue;
    }

    if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
};

const contractChecks = [
  {
    label: 'integration suffix',
    configEntries: ['src/**/*.integration.{test,spec}.ts'],
    matches: (relativePath) => relativePath.includes('.integration.') && isVitestCandidate(relativePath),
  },
  {
    label: 'legacy integration suffix',
    configEntries: ['src/**/*.int.{test,spec}.ts'],
    matches: (relativePath) => relativePath.includes('.int.') && isVitestCandidate(relativePath),
  },
  {
    label: 'backend e2e suffix',
    configEntries: ['src/**/*.e2e.{test,spec}.ts'],
    matches: (relativePath) => relativePath.includes('.e2e.') && isVitestCandidate(relativePath),
  },
  {
    label: 'performance suffix',
    configEntries: ['src/**/*.perf.{test,spec}.ts'],
    matches: (relativePath) => relativePath.includes('.perf.') && isVitestCandidate(relativePath),
  },
  {
    label: 'load suffix',
    configEntries: ['src/**/*.load.{test,spec}.ts'],
    matches: (relativePath) => relativePath.includes('.load.') && isVitestCandidate(relativePath),
  },
  {
    label: 'integration-only __tests__ directory',
    configEntries: ['src/**/__tests__/integration/**'],
    matches: (relativePath) => relativePath.includes('/__tests__/integration/') && isVitestCandidate(relativePath),
  },
  {
    label: '__integration__ directory',
    configEntries: ['src/**/__integration__/**'],
    matches: (relativePath) => relativePath.includes('/__integration__/') && isVitestCandidate(relativePath),
  },
  {
    label: 'integration directory',
    configEntries: ['src/**/integration/**'],
    matches: (relativePath) => relativePath.includes('/integration/') && isVitestCandidate(relativePath),
  },
];

if (!existsSync(BACKEND_SRC_ROOT)) {
  console.error(`❌ Backend source root not found: ${BACKEND_SRC_ROOT}`);
  process.exit(1);
}

if (!existsSync(BACKEND_VITEST_CONFIG)) {
  console.error(`❌ Backend Vitest config not found: ${BACKEND_VITEST_CONFIG}`);
  process.exit(1);
}

const backendVitestConfigSource = readFileSync(BACKEND_VITEST_CONFIG, 'utf8');

const vitestCandidateFiles = walkFiles(BACKEND_SRC_ROOT)
  .map((filePath) => path.relative(ROOT, filePath).split(path.sep).join('/'))
  .filter(isVitestCandidate)
  .sort((left, right) => left.localeCompare(right));

const violations = [];
const detectedFiles = [];

for (const contractCheck of contractChecks) {
  const matchingFiles = vitestCandidateFiles.filter((filePath) => contractCheck.matches(filePath));
  if (matchingFiles.length === 0) {
    continue;
  }

  detectedFiles.push(...matchingFiles);

  const missingConfigEntries = contractCheck.configEntries.filter(
    (configEntry) => !backendVitestConfigSource.includes(`'${configEntry}'`) && !backendVitestConfigSource.includes(`"${configEntry}"`),
  );

  if (missingConfigEntries.length > 0) {
    violations.push({
      label: contractCheck.label,
      files: matchingFiles,
      missingConfigEntries,
    });
  }
}

if (violations.length > 0) {
  console.error('❌ Backend unit-test scope regression detected.');
  console.error('   Non-unit backend tests exist, but packages/backend/vitest.config.ts is missing one or more required exclusions.\n');

  for (const violation of violations) {
    console.error(`Category: ${violation.label}`);
    console.error(`Missing config entries: ${violation.missingConfigEntries.join(', ')}`);
    console.error('Matched files:');
    for (const filePath of violation.files) {
      console.error(`  - ${filePath}`);
    }
    console.error('');
  }

  process.exit(1);
}

if (detectedFiles.length === 0) {
  console.error('❌ No backend non-unit test files were detected.');
  console.error('   The guard expects representative excluded suites so it can verify the unit-only contract.');
  console.error('   If files were renamed or moved, update this guard and packages/backend/vitest.config.ts together.');
  process.exit(1);
}

console.log('✅ Backend unit-test scope exclusions cover the detected non-unit suites.');
console.log(`✅ Verified ${new Set(detectedFiles).size} backend non-unit test files against packages/backend/vitest.config.ts.`);
