#!/usr/bin/env node
/**
 * REQ-C1: Flake rate gate
 *
 * Reads a Vitest JSON report and computes the flake rate:
 *   flake rate = tests that passed only after retry / total test runs
 *
 * Fails with exit code 1 if the flake rate exceeds the configured threshold.
 * Emits a flake-summary.json artifact for CI visibility.
 *
 * Usage:
 *   node scripts/ci/flake-gate.mjs --report <path> [--threshold <0-100>] [--out <path>]
 *
 * Arguments:
 *   --report     Path to Vitest JSON report (required)
 *   --threshold  Max allowed flake rate as a percentage (default: 2)
 *   --out        Output path for flake-summary.json (default: artifacts/ci-lanes/flake-report/flake-summary.json)
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const reportPath = getArg('--report');
const threshold = Number(getArg('--threshold') ?? '2');
const outPath = getArg('--out') ?? 'artifacts/ci-lanes/flake-report/flake-summary.json';

if (!reportPath) {
  console.error('ERROR: --report <path> is required');
  process.exit(1);
}

if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
  console.error(`ERROR: --threshold must be a number between 0 and 100, got: ${getArg('--threshold')}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Report parsing
// ---------------------------------------------------------------------------

let report;
try {
  report = JSON.parse(readFileSync(resolve(reportPath), 'utf8'));
} catch (err) {
  console.error(`ERROR: Failed to read report at ${reportPath}: ${err.message}`);
  process.exit(1);
}

/**
 * Vitest JSON report shape (--reporter=json):
 * {
 *   numTotalTests: number,
 *   numPassedTests: number,
 *   numFailedTests: number,
 *   testResults: Array<{
 *     name: string,           // file path
 *     assertionResults: Array<{
 *       title: string,
 *       fullName: string,
 *       status: 'passed' | 'failed' | 'pending' | 'todo',
 *       numRetries?: number,  // present when retry is configured and the test
 *                             // needed retries to pass (Vitest ≥ 1.x)
 *       failureMessages: string[],
 *     }>
 *   }>
 * }
 *
 * A test is considered "flaky" when:
 *   - status === 'passed' AND numRetries > 0
 *     (Vitest sets numRetries to the number of retry attempts consumed)
 *
 * REQUIRED CONFIGURATION: retry must be enabled in vitest.config.ts for
 * numRetries to be populated. Without retry, all tests have numRetries === 0
 * and flake detection is a no-op. Add to vitest.config.ts:
 *   test: { retry: 2 }
 */

const flaky = [];
let totalTests = 0;

for (const fileResult of report.testResults ?? []) {
  // Vitest JSON uses assertionResults (Jest-compatible field name).
  for (const test of fileResult.assertionResults ?? []) {
    if (test.status === 'pending' || test.status === 'todo') continue;
    totalTests++;
    const isFlaky = test.status === 'passed' && (test.numRetries ?? 0) > 0;

    if (isFlaky) {
      flaky.push({
        file: fileResult.name,
        title: test.fullName ?? test.title,
        retryCount: test.numRetries,
      });
    }
  }
}

if (totalTests === 0) {
  console.error(
    'ERROR: No tests found in report. Either the report is empty, the file ' +
    'path is wrong, or the Vitest JSON reporter was not configured. ' +
    'Ensure --reporter=json is set and the report file exists.'
  );
  process.exit(1);
}

const flakyCount = flaky.length;
const flakyRate = totalTests > 0 ? (flakyCount / totalTests) * 100 : 0;
const passed = flakyRate <= threshold;

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const summary = {
  generatedAt: new Date().toISOString(),
  reportPath,
  totalTests,
  flakyCount,
  flakyRatePercent: Number(flakyRate.toFixed(2)),
  thresholdPercent: threshold,
  passed,
  flakyTests: flaky,
};

mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(resolve(outPath), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

console.log(`Flake gate: ${flakyCount}/${totalTests} tests flaky (${flakyRate.toFixed(2)}%) — threshold: ${threshold}%`);

if (flaky.length > 0) {
  console.log('\nFlaky tests:');
  for (const t of flaky) {
    console.log(`  [${t.retryCount} retries] ${t.file} > ${t.title}`);
  }
}

console.log(`\nFlake summary written to ${outPath}`);

if (!passed) {
  console.error(
    `\nERROR: Flake rate ${flakyRate.toFixed(2)}% exceeds threshold ${threshold}%. ` +
    `Fix or quarantine the ${flakyCount} flaky test(s) listed above.`
  );
  process.exit(1);
}

console.log('Flake gate passed.');
