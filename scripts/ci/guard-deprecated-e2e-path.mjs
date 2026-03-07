#!/usr/bin/env node

import { readdir } from 'node:fs/promises';
import path from 'node:path';

const deprecatedRoot = path.resolve('tests/test/e2e');

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(path.relative(process.cwd(), fullPath));
    }
  }

  return files;
}

async function main() {
  let files = [];

  try {
    files = await listFiles(deprecatedRoot);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      console.log('✅ Deprecated e2e path is absent: tests/test/e2e');
      return;
    }

    throw error;
  }

  // Only treat test files in the deprecated path as an error; allow non-test files (e.g., README).
  const testFiles = files.filter(
    (file) => file.endsWith('.test.ts') || file.endsWith('.spec.ts'),
  );

  if (testFiles.length > 0) {
    console.error('❌ Deprecated e2e path is no longer allowed. Move these specs to tests/e2e/:');
    for (const file of testFiles) {
      console.error(` - ${file}`);
    }
    process.exit(1);
  }

  if (files.length > 0) {
    console.log('✅ Deprecated e2e path exists and contains no test specs (only non-test files): tests/test/e2e');
  } else {
    console.log('✅ Deprecated e2e path exists but is empty: tests/test/e2e');
  }
}

main().catch((error) => {
  console.error('❌ Failed to validate deprecated e2e path:', error);
  process.exit(1);
});
