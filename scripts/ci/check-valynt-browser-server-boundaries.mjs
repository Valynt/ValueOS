#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const appRoot = 'apps/ValyntApp/src';
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const browserRoots = [
  'apps/ValyntApp/src/main.tsx',
  'apps/ValyntApp/src/routes',
  'apps/ValyntApp/src/app/routes',
  'apps/ValyntApp/src/pages',
  'apps/ValyntApp/src/views',
  'apps/ValyntApp/src/hooks',
  'apps/ValyntApp/src/components',
  'apps/ValyntApp/src/contexts',
  'apps/ValyntApp/src/api',
  'apps/ValyntApp/src/services',
  'apps/ValyntApp/src/lib',
];
const ignoredSegments = ['__tests__', '.test.', '.spec.', '.stories.'];
const importRegex =
  /(?:import|export)\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

const violations = [];

for (const file of walk(path.join(repoRoot, appRoot))) {
  const rel = toRel(file);
  if (!isSourceFile(file) || !isBrowserBoundaryFile(rel)) {
    continue;
  }

  const source = fs.readFileSync(file, 'utf8');
  const imports = [...source.matchAll(importRegex)]
    .map((match) => match[1] ?? match[2])
    .filter(Boolean);

  for (const specifier of imports) {
    const normalizedSpecifier = resolveSpecifier(rel, specifier);
    if (!normalizedSpecifier) {
      continue;
    }

    if (
      normalizedSpecifier.endsWith('.server') ||
      normalizedSpecifier.endsWith('.server.ts') ||
      normalizedSpecifier.endsWith('.server.tsx') ||
      normalizedSpecifier.includes('/settings.server') ||
      normalizedSpecifier.includes('/supabase.server')
    ) {
      violations.push(`${rel}: browser boundary imports server-only module "${specifier}"`);
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Valynt browser/server boundary check failed:');
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log('✅ Valynt browser/server boundary check passed.');

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'build', 'coverage'].includes(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    files.push(fullPath);
  }
  return files;
}

function isSourceFile(filePath) {
  return sourceExtensions.has(path.extname(filePath));
}

function toRel(absolutePath) {
  return path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
}

function isBrowserBoundaryFile(relativePath) {
  if (relativePath.includes('.server.')) {
    return false;
  }
  if (ignoredSegments.some((segment) => relativePath.includes(segment))) {
    return false;
  }
  return browserRoots.some((root) => relativePath === root || relativePath.startsWith(`${root}/`));
}

function resolveSpecifier(importerRel, specifier) {
  if (specifier.startsWith('@/')) {
    return `apps/ValyntApp/src/${specifier.slice(2)}`;
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return path
      .normalize(path.join(path.dirname(importerRel), specifier))
      .replaceAll(path.sep, '/');
  }

  return specifier;
}
