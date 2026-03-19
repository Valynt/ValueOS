#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const workflowsDir = path.join(repoRoot, '.github', 'workflows');
const packageJsonPath = path.join(repoRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const packageManager = packageJson.packageManager;
if (typeof packageManager !== 'string' || !packageManager.startsWith('pnpm@')) {
  console.error('❌ package.json packageManager must declare pnpm as pnpm@<version>.');
  process.exit(1);
}

const packageManagerVersion = packageManager.slice('pnpm@'.length).split('+')[0];
const expectedActionRef = 'v4';
const workflowFiles = fs.readdirSync(workflowsDir)
  .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
  .sort();

const violations = [];

for (const workflowFile of workflowFiles) {
  const workflowPath = path.join(workflowsDir, workflowFile);
  const relativePath = path.relative(repoRoot, workflowPath);
  const lines = fs.readFileSync(workflowPath, 'utf8').split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (/^\s*PNPM_VERSION\s*:/.test(line)) {
      violations.push(
        `${relativePath}:${index + 1} -> PNPM_VERSION workflow env is not allowed; use package.json packageManager (${packageManagerVersion}) as the single source of truth`,
      );
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const useMatch = line.match(/^\s*uses:\s*pnpm\/action-setup@(v\d+)\s*$/);
    if (!useMatch) {
      continue;
    }

    const actionRef = useMatch[1];
    if (actionRef !== expectedActionRef) {
      violations.push(
        `${relativePath}:${index + 1} -> expected pnpm/action-setup@${expectedActionRef}, found pnpm/action-setup@${actionRef}`,
      );
    }

    const usesIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
    let inWithBlock = false;
    let withIndent = 0;

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor];
      if (candidate.trim() === '') {
        continue;
      }

      const indent = candidate.match(/^(\s*)/)?.[1].length ?? 0;
      if (indent <= usesIndent) {
        break;
      }

      if (!inWithBlock && /^\s*with:\s*$/.test(candidate)) {
        inWithBlock = true;
        withIndent = indent;
        continue;
      }

      if (inWithBlock) {
        if (indent <= withIndent) {
          break;
        }

        const versionMatch = candidate.match(/^\s*version:\s*(.+?)\s*$/);
        if (versionMatch) {
          violations.push(
            `${relativePath}:${cursor + 1} -> pnpm/action-setup must read pnpm ${packageManagerVersion} from package.json packageManager; remove explicit version: ${versionMatch[1]}`,
          );
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Workflow pnpm contract drift detected:');
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log(
  `✅ Verified ${workflowFiles.length} workflow files use pnpm/action-setup@${expectedActionRef} without overriding package.json packageManager (pnpm ${packageManagerVersion}).`,
);
