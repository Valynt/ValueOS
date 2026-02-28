#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import process from 'process';

const repoRoot = resolve(new URL('.', import.meta.url).pathname, '..', '..');
const backendDist = resolve(repoRoot, 'packages/backend/dist');

if (!existsSync(backendDist)) {
  console.error(`[bundle-safety] Missing backend build output at ${backendDist}. Run backend build first.`);
  process.exit(1);
}

function collectJsFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];

  for (const entry of entries) {
    const absolutePath = resolve(dir, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      files.push(...collectJsFiles(absolutePath));
      continue;
    }

    if (absolutePath.endsWith('.js')) {
      files.push(absolutePath);
    }
  }

  return files;
}

const bundleFiles = collectJsFiles(backendDist);

if (bundleFiles.length === 0) {
  console.error('[bundle-safety] No JavaScript bundle files found in backend dist output.');
  process.exit(1);
}

const forbiddenPatterns = [
  { name: 'routes/dev', regex: /routes\/dev|routes\\dev|["']\.\/dev\.js["']/ },
  { name: 'child_process.exec', regex: /child_process\.exec|\bexec\s*[:=]\s*.*child_process|from\s+["']child_process["']/ },
];

const violations = [];

for (const file of bundleFiles) {
  const content = readFileSync(file, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.regex.test(content)) {
      violations.push({ file, pattern: pattern.name });
    }
  }
}

if (violations.length > 0) {
  console.error('[bundle-safety] Forbidden references detected in backend production bundle:');
  for (const violation of violations) {
    console.error(` - ${violation.pattern} in ${violation.file}`);
  }
  process.exit(1);
}

console.log(`[bundle-safety] PASS: scanned ${bundleFiles.length} backend bundle files, no forbidden references found.`);
