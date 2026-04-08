#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, 'package.json');
const docsToCheck = [
  'docs/getting-started/02-quickstart.md',
  'docs/getting-started/QUICKSTART.md',
];

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const scripts = new Set(Object.keys(packageJson.scripts ?? {}));

const pnpmRunPattern = /\bpnpm\s+run\s+([a-zA-Z0-9:_-]+)/g;
const missing = [];

for (const relativeFile of docsToCheck) {
  const absoluteFile = path.join(repoRoot, relativeFile);
  const content = fs.readFileSync(absoluteFile, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const [lineIndex, line] of lines.entries()) {
    let match = pnpmRunPattern.exec(line);
    while (match) {
      const scriptName = match[1];
      if (!scripts.has(scriptName)) {
        missing.push(`${relativeFile}:${lineIndex + 1} -> ${scriptName}`);
      }
      match = pnpmRunPattern.exec(line);
    }
    pnpmRunPattern.lastIndex = 0;
  }
}

if (missing.length > 0) {
  console.error('❌ Missing package.json scripts referenced in quickstart docs:');
  for (const item of missing) {
    console.error(` - ${item}`);
  }
  process.exit(1);
}

console.log(`✅ Verified pnpm run script references in ${docsToCheck.length} quickstart docs.`);
