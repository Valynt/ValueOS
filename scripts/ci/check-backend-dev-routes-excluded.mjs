#!/usr/bin/env node
/**
 * check-backend-dev-routes-excluded.mjs
 *
 * Verifies that dev route code (specifically child_process.exec) is not
 * present in the production backend build output.
 *
 * dev.ts imports child_process.exec and exposes shell execution via HTTP.
 * It is gated at runtime (NODE_ENV + ENABLE_DEV_ROUTES), but the safest
 * posture is to ensure the module is absent from production artifacts entirely.
 *
 * This script scans the compiled backend output directory for:
 *   1. Any reference to "child_process" — the Node.js module that enables exec
 *   2. Any reference to the dev route path patterns
 *
 * Exit 1 if any forbidden pattern is found in production build output.
 *
 * Usage:
 *   node scripts/ci/check-backend-dev-routes-excluded.mjs [build-dir]
 *
 * Default build-dir: packages/backend/dist
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const buildDir = process.argv[2]
  ? resolve(process.argv[2])
  : join(ROOT, 'packages/backend/dist');

const failures = [];
const warnings = [];

function pass(msg) { console.log('  ✓ ' + msg); }
function fail(msg) { failures.push(msg); console.error('  ✗ ' + msg); }
function warn(msg) { warnings.push(msg); console.warn('  ⚠ ' + msg); }

console.log('\nBackend Dev Routes Exclusion Gate\n');

// ── Check 1: Build directory exists ─────────────────────────────────────────
if (!existsSync(buildDir)) {
  warn(`Build directory not found: ${buildDir} — skipping bundle scan (run build first)`);
  console.log('\nResult: SKIP (no build output to scan)');
  console.log('Run `pnpm build` before this check in CI.\n');
  process.exit(0);
}

pass(`Build directory found: ${relative(ROOT, buildDir)}`);

// ── Collect JS files from build output ──────────────────────────────────────
function walkJs(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.git'].includes(entry)) continue;
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      walkJs(full, out);
    } else if (/\.(js|mjs|cjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const jsFiles = walkJs(buildDir);
console.log(`\nScanning ${jsFiles.length} JS files in build output...\n`);

if (jsFiles.length === 0) {
  warn('No JS files found in build output — build may be empty');
}

// ── Check 2: No child_process import in production bundle ───────────────────
// child_process is the Node.js module that enables shell execution.
// It must not appear in production backend bundles.
//
// Note: The dynamic import in registerDevRoutes() means the dev.ts module
// should only be loaded at runtime when ENABLE_DEV_ROUTES=true. However,
// bundlers may still inline the module. This check catches that case.
const FORBIDDEN_PATTERNS = [
  {
    pattern: /require\(['"]child_process['"]\)|from ['"]child_process['"]/,
    description: 'child_process import (enables shell exec — must not ship in production)',
    // Allow the check script itself and test files
    allowPaths: ['check-backend-dev-routes-excluded', '__tests__', '.test.', 'spec.'],
  },
  {
    pattern: /\/api\/dev['"]|app\.use\(['"]\/api\/dev/,
    description: 'dev route registration (/api/dev mount)',
    allowPaths: ['check-backend-dev-routes-excluded', '__tests__', '.test.', 'spec.', 'devRoutes'],
  },
];

let scannedCount = 0;
for (const file of jsFiles) {
  const rel = relative(ROOT, file);
  const content = readFileSync(file, 'utf8');
  scannedCount++;

  for (const { pattern, description, allowPaths } of FORBIDDEN_PATTERNS) {
    if (allowPaths.some(p => rel.includes(p))) continue;
    if (pattern.test(content)) {
      fail(`${rel}: contains forbidden pattern — ${description}`);
    }
  }
}

pass(`Scanned ${scannedCount} files`);

// ── Summary ──────────────────────────────────────────────────────────────────
console.log();
if (failures.length > 0) {
  console.error(`\nBackend Dev Routes Exclusion Gate: FAIL (${failures.length} issue(s))\n`);
  console.error('Dev route code must not be present in production build output.');
  console.error('Ensure dev.ts is only imported via dynamic import() inside shouldEnableDevRoutes()');
  console.error('and that your bundler does not statically inline it.\n');
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn(`\nBackend Dev Routes Exclusion Gate: WARN (${warnings.length} warning(s))\n`);
}

console.log('Backend Dev Routes Exclusion Gate: PASS\n');
process.exit(0);
