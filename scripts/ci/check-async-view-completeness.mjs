#!/usr/bin/env node
/**
 * REQ-A2: Async view completeness check
 *
 * Scans all .tsx files under apps/ValyntApp/src for Suspense usage and
 * verifies that each Suspense block:
 *   1. Has a non-null fallback (skeleton or loading state)
 *   2. Is wrapped by an ErrorBoundary somewhere in the same file
 *
 * Exits 1 if any violation is found.
 *
 * Exemptions:
 *   - fallback={null} is allowed for non-content UI chrome (widgets, banners)
 *     when the file is listed in EXEMPTIONS below.
 *   - Test files are excluded.
 */

import { readFileSync, readdirSync, statSync, lstatSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../../apps/ValyntApp/src', import.meta.url).pathname;

// Files where fallback={null} is intentional (non-content chrome).
const EXEMPTIONS = new Set([
  'AppRoutes.tsx', // BetaFeedbackWidget + EnvironmentBanner — non-critical chrome
]);

// ---------------------------------------------------------------------------
// File walker
// ---------------------------------------------------------------------------

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    // Use lstatSync to detect symlinks without following them.
    // Skip symlinked directories (e.g. src/sdui → packages/sdui/src) to
    // avoid double-scanning package source trees.
    const lstat = lstatSync(full);
    if (lstat.isSymbolicLink()) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__' || entry === 'test') continue;
      walk(full, files);
    } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx') && !entry.endsWith('.spec.tsx')) {
      files.push(full);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

const violations = [];

for (const filePath of walk(ROOT)) {
  const src = readFileSync(filePath, 'utf8');
  const fileName = filePath.split('/').pop();

  if (!src.includes('Suspense')) continue;

  const hasNullFallback = /fallback=\{null\}/.test(src);
  const hasSkeletonFallback = /fallback=\{(?!null)/.test(src);
  const hasErrorBoundary = /ErrorBoundary/.test(src);

  // Check 1: fallback={null} without exemption
  if (hasNullFallback && !EXEMPTIONS.has(fileName)) {
    violations.push({
      file: relative(process.cwd(), filePath),
      issue: 'Suspense has fallback={null} — provide a skeleton or loading state',
    });
  }

  // Check 2: Suspense present but no ErrorBoundary in the file
  // (ErrorBoundary may be in a parent file — only flag if this file owns the Suspense boundary)
  if ((hasNullFallback || hasSkeletonFallback) && !hasErrorBoundary) {
    violations.push({
      file: relative(process.cwd(), filePath),
      issue: 'Suspense present but no ErrorBoundary found in this file — wrap async content with an ErrorBoundary',
    });
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

if (violations.length === 0) {
  console.log('check-async-view-completeness: all Suspense blocks have skeleton fallbacks and ErrorBoundary coverage.');
  process.exit(0);
}

console.error(`check-async-view-completeness: ${violations.length} violation(s) found:\n`);
for (const v of violations) {
  console.error(`  ${v.file}\n    → ${v.issue}\n`);
}
process.exit(1);
