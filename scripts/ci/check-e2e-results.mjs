#!/usr/bin/env node
/**
 * Parses a Playwright JSON results file and fails if any test failed.
 *
 * Usage:
 *   node scripts/ci/check-e2e-results.mjs \
 *     --results artifacts/e2e/results/results.json \
 *     --fail-on-any-failure
 */

import fs from "node:fs";

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { results: null, failOnAnyFailure: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--results") result.results = args[++i];
    if (args[i] === "--fail-on-any-failure") result.failOnAnyFailure = true;
  }
  if (!result.results) {
    console.error("Usage: check-e2e-results.mjs --results <path> [--fail-on-any-failure]");
    process.exit(1);
  }
  return result;
}

const { results: resultsPath, failOnAnyFailure } = parseArgs();

if (!fs.existsSync(resultsPath)) {
  console.error(`E2E results file not found: ${resultsPath}`);
  console.error("Ensure Playwright ran with --reporter=json and --output pointing to this path.");
  process.exit(1);
}

const raw = fs.readFileSync(resultsPath, "utf8");
let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error(`Failed to parse E2E results: ${resultsPath}`);
  process.exit(1);
}

// Playwright JSON reporter shape:
// { stats: { expected, unexpected, skipped, ... }, suites: [...] }
const stats = report.stats ?? {};
const unexpected = stats.unexpected ?? 0;
const expected = stats.expected ?? 0;
const skipped = stats.skipped ?? 0;
const flaky = stats.flaky ?? 0;

console.log(`E2E results: ${expected} passed, ${unexpected} failed, ${skipped} skipped, ${flaky} flaky`);

if (failOnAnyFailure && unexpected > 0) {
  // Collect failing test titles for the error message
  const failures = [];
  function collectFailures(suites) {
    for (const suite of suites ?? []) {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          if (test.status === "unexpected") {
            failures.push(`  ❌ ${suite.title} > ${spec.title}`);
          }
        }
      }
      collectFailures(suite.suites);
    }
  }
  collectFailures(report.suites);

  console.error(`\n❌ E2E gate: ${unexpected} test(s) failed:\n`);
  for (const f of failures.slice(0, 20)) console.error(f);
  if (failures.length > 20) console.error(`  ... and ${failures.length - 20} more`);
  console.error(`\nAll E2E tests must pass before a release can proceed.`);
  console.error(`Review artifacts/e2e/ for traces and screenshots.`);
  process.exit(1);
}

if (expected === 0 && skipped === 0) {
  console.error("❌ E2E gate: no tests were executed. Check Playwright configuration.");
  process.exit(1);
}

console.log(`✅ E2E gate: all ${expected} test(s) passed.`);
