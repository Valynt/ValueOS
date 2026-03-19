#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { rootVitestProjects } from './vitest-workspace-topology.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const WORKSPACE_FILE = path.join(ROOT, 'pnpm-workspace.yaml');
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.turbo']);

function parseWorkspacePatterns() {
  const lines = readFileSync(WORKSPACE_FILE, 'utf8').split(/\r?\n/);
  return lines
    .map((line) => line.match(/^\s*-\s+"([^"]+)"\s*$/)?.[1] ?? null)
    .filter(Boolean);
}

function packageDirsForPattern(pattern) {
  if (!pattern.includes('*')) {
    const pkgJson = path.join(ROOT, pattern, 'package.json');
    return existsSync(pkgJson) ? [pattern] : [];
  }

  const segments = pattern.split('/');
  const results = [];

  function walk(baseDir, index, acc) {
    if (index === segments.length) {
      const candidate = acc.join('/');
      if (existsSync(path.join(ROOT, candidate, 'package.json'))) {
        results.push(candidate);
      }
      return;
    }

    const segment = segments[index];
    if (segment !== '*') {
      walk(baseDir, index + 1, [...acc, segment]);
      return;
    }

    const dirToRead = path.join(ROOT, ...acc);
    if (!existsSync(dirToRead)) return;

    for (const entry of readdirSync(dirToRead, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(baseDir, index + 1, [...acc, entry.name]);
    }
  }

  walk(ROOT, 0, []);
  return results;
}

function discoverWorkspacePackages() {
  const dirs = new Set();
  for (const pattern of parseWorkspacePatterns()) {
    for (const dir of packageDirsForPattern(pattern)) {
      dirs.add(dir);
    }
  }
  return [...dirs].sort();
}

function hasTestFiles(dir) {
  const stack = [path.join(ROOT, dir)];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (TEST_FILE_PATTERN.test(entry.name)) {
        return true;
      }
    }
  }

  return false;
}

const workspacePackages = discoverWorkspacePackages();
const configured = new Set(rootVitestProjects);
const packagesWithTests = workspacePackages.filter(hasTestFiles);

function isCoveredByRootWorkspace(dir) {
  if (configured.has(dir)) return true;
  return rootVitestProjects.some((projectDir) => dir.startsWith(`${projectDir}/`));
}

const missingFromRoot = packagesWithTests.filter((dir) => !isCoveredByRootWorkspace(dir));
const missingConfigs = rootVitestProjects.filter((dir) => !existsSync(path.join(ROOT, dir, 'vitest.config.ts')));

if (missingFromRoot.length > 0 || missingConfigs.length > 0) {
  if (missingFromRoot.length > 0) {
    console.error('❌ Workspace packages with tests are missing from the root Vitest workspace:');
    for (const dir of missingFromRoot) {
      console.error(`  - ${dir}`);
    }
  }

  if (missingConfigs.length > 0) {
    console.error('❌ Root Vitest workspace entries are missing package-local vitest.config.ts files:');
    for (const dir of missingConfigs) {
      console.error(`  - ${dir}`);
    }
  }

  process.exit(1);
}

const orphanedProjects = rootVitestProjects.filter((dir) => workspacePackages.includes(dir) && !packagesWithTests.includes(dir));
if (orphanedProjects.length > 0) {
  console.warn('⚠️ Root Vitest workspace includes packages that currently have no test files:');
  for (const dir of orphanedProjects) {
    console.warn(`  - ${dir}`);
  }
}

console.log(`✅ Root Vitest workspace covers all ${packagesWithTests.length} workspace packages that contain test files.`);
