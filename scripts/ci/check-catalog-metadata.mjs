#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const catalogFile = 'catalog-info.yaml';
const catalogPath = path.resolve(repoRoot, catalogFile);
const catalog = await readFile(catalogPath, 'utf8');

const checks = [
  {
    field: 'owner',
    pattern: /^\s*owner:\s*["']?([^"'\n]+)["']?\s*$/m,
    validator: (value) => /^team:[a-z0-9-]+$/.test(value) && !/TODO|REPLACE_ME/i.test(value),
    expectation: 'a Backstage team identifier like team:platform-engineering',
  },
  {
    field: 'system',
    pattern: /^\s*system:\s*["']?([^"'\n]+)["']?\s*$/m,
    validator: (value) => /^[a-z0-9-]+$/.test(value) && !/TODO|REPLACE_ME/i.test(value),
    expectation: 'a registered system identifier like value-engineering-platform',
  },
];

const errors = [];
for (const check of checks) {
  const match = catalog.match(check.pattern);
  if (!match) {
    errors.push(`Missing required field: ${check.field}`);
    continue;
  }

  const value = match[1].trim();
  if (!check.validator(value)) {
    errors.push(`Invalid ${check.field}: ${JSON.stringify(value)} (expected ${check.expectation})`);
  }
}

if (errors.length > 0) {
  console.error(`❌ Service catalog metadata check failed for ${catalogFile}.`);
  for (const error of errors) {
    console.error(` - ${error}`);
  }
  process.exit(1);
}

console.log(`✅ Service catalog metadata check passed for ${catalogFile}.`);
