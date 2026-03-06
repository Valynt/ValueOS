#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = process.cwd();
const modulesDir = resolve(root, 'infra/terraform/modules');
const bannedPatterns = [/\bstub\b/i, /TODO:\s*Replace with real resources/i];

const walk = (dir) => {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry);
    const st = statSync(fullPath);
    if (st.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (fullPath.endsWith('.tf')) {
      files.push(fullPath);
    }
  }
  return files;
};

const violations = [];

for (const file of walk(modulesDir)) {
  const content = readFileSync(file, 'utf8');
  for (const pattern of bannedPatterns) {
    if (pattern.test(content)) {
      violations.push({
        file: relative(root, file),
        pattern: pattern.toString(),
      });
    }
  }
}

if (violations.length > 0) {
  console.error('Terraform module validation failed due to placeholder/stub content:');
  for (const violation of violations) {
    console.error(`- ${violation.file} matches ${violation.pattern}`);
  }
  process.exit(1);
}

console.log('Terraform module placeholder/stub validation passed.');
