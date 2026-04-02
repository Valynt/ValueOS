#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const raw = execSync('pnpm m ls -r --depth -1 --json', {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});

const workspaces = JSON.parse(raw);
const packages = workspaces
  .filter((pkg) => pkg.path && pkg.path !== repoRoot)
  .map((pkg) => {
    const packageJsonPath = path.join(pkg.path, 'package.json');
    if (!fs.existsSync(packageJsonPath)) return null;
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return {
      name: packageJson.name,
      path: pkg.path,
      hasTypecheck: Boolean(packageJson.scripts?.typecheck),
    };
  })
  .filter((pkg) => pkg?.hasTypecheck);

let failed = false;

for (const pkg of packages) {
  const relativePath = path.relative(repoRoot, pkg.path) || '.';
  const cmd = `pnpm turbo run typecheck --filter=${pkg.name}`;
  console.log(`\n=== ${pkg.name} (${relativePath}) ===`);
  try {
    execSync(cmd, {
      cwd: pkg.path,
      stdio: 'inherit',
      env: process.env,
    });
  } catch {
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
}
