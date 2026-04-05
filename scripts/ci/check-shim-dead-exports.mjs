#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const shimModules = [
  {
    path: 'packages/backend/src/services/runtime/context-store/index.ts',
    importPattern: String.raw`services/runtime/context-store`,
  },
  {
    path: 'packages/backend/src/services/runtime/execution-runtime/index.ts',
    importPattern: String.raw`services/runtime/execution-runtime`,
  },
];

const sourceRoots = ['packages/backend/src'];
const failures = [];

for (const shimModule of shimModules) {
  if (!fs.existsSync(shimModule.path)) {
    continue;
  }

  const source = fs.readFileSync(shimModule.path, 'utf8');
  if (!source.startsWith('// Re-export shim')) {
    continue;
  }

  let importHits = '';
  try {
    importHits = execSync(
      [
        'rg',
        '--line-number',
        '--glob', '*.ts',
        '--glob', '*.tsx',
        '--glob', '*.js',
        '--glob', '*.mjs',
        '--glob', '*.cjs',
        shimModule.importPattern,
        ...sourceRoots,
      ].join(' '),
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
  } catch (error) {
    if (error && error.status === 1) {
      importHits = '';
    } else {
      throw error;
    }
  }

  const filteredHits = importHits
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith(`${shimModule.path}:`));

  if (filteredHits.length === 0) {
    failures.push(
      [
        `Dead shim export detected: ${shimModule.path}`,
        'Module is marked as a re-export shim but has zero internal references.',
        'Delete the shim or migrate at least one internal consumer before keeping it.',
      ].join('\n')
    );
  }
}

if (failures.length > 0) {
  throw new Error(failures.join('\n\n'));
}

console.log('Shim dead-export check passed.');
