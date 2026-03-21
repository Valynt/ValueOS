#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { workspaceVitestProjects } from './vitest-workspace-topology.mjs';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith('--')) {
    continue;
  }

  const next = process.argv[index + 1];
  if (!next || next.startsWith('--')) {
    args.set(arg.slice(2), 'true');
    continue;
  }

  args.set(arg.slice(2), next);
  index += 1;
}

const scope = args.get('scope') ?? 'full';
const baseSha = args.get('base-sha') ?? '';
const headSha = args.get('head-sha') ?? '';

const fullMatrix = workspaceVitestProjects;

if (scope !== 'affected') {
  process.stdout.write(JSON.stringify(scope === 'full' ? fullMatrix : []));
  process.exit(0);
}

const zeroShaPattern = /^0+$/;
const missingDiffContext =
  !baseSha ||
  !headSha ||
  zeroShaPattern.test(baseSha) ||
  zeroShaPattern.test(headSha);

if (missingDiffContext) {
  process.stdout.write(JSON.stringify(fullMatrix));
  process.exit(0);
}

let changedFiles = [];

try {
  const diffOutput = execFileSync('git', ['diff', '--name-only', `${baseSha}...${headSha}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

  changedFiles = diffOutput ? diffOutput.split('\n').filter(Boolean) : [];
} catch (error) {
  process.stdout.write(JSON.stringify(fullMatrix));
  process.exit(0);
}

if (changedFiles.length === 0) {
  process.stdout.write(JSON.stringify([]));
  process.exit(0);
}

const fullImpactPrefixes = [
  '.github/workflows/',
  '.github/actions/',
  '.github/scripts/',
  'scripts/ci/',
  'tests/',
  'packages/shared/',
  'packages/components/',
  'packages/config-v2/',
  'packages/test-utils/',
];

const fullImpactFiles = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'vitest.config.ts',
  'tsconfig.json',
  'tsconfig.base.json',
  'turbo.json',
]);

const shouldRunFullMatrix = changedFiles.some((file) => {
  if (fullImpactFiles.has(file)) {
    return true;
  }

  return fullImpactPrefixes.some((prefix) => file.startsWith(prefix));
});

if (shouldRunFullMatrix) {
  process.stdout.write(JSON.stringify(fullMatrix));
  process.exit(0);
}

const impactedProjects = fullMatrix.filter((project) =>
  changedFiles.some((file) => file === project.dir || file.startsWith(`${project.dir}/`)),
);

process.stdout.write(JSON.stringify(impactedProjects));
