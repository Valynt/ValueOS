#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const reportPath = process.env.RLS_VITEST_JSON_REPORT_PATH ?? 'reports/compliance/rls/vitest-rls.json';
const reportJunitPath = process.env.RLS_VITEST_JUNIT_REPORT_PATH ?? 'reports/compliance/rls/vitest-rls.junit.xml';
const minimumExecuted = Number(process.env.RLS_MIN_EXECUTED_TESTS ?? '10');
const suiteLabel = process.env.RLS_SUITE_LABEL ?? 'tenant-isolation-rls';

const rlsSpecs = [
  'tests/security/rls-tenant-isolation.test.ts',
  'tests/security/api-tenant-isolation.test.ts',
  'tests/security/supabase-rls-policy-matrix.test.ts',
  'tests/security/agent-invocation-tenant-boundary.test.ts',
  'packages/memory/tests/tenant-vector-isolation.test.ts',
  'packages/memory/tests/tenant-semantic-retrieval-boundary.test.ts',
  'packages/backend/src/workers/__tests__/tenantContextBootstrap.test.ts',
  'packages/backend/src/workers/__tests__/WorkerTenantBoundaryIsolation.test.ts',
  'packages/backend/src/workers/__tests__/BullMQTenantIsolation.test.ts',
  'packages/backend/src/workers/__tests__/BullMQTenantIsolation.behavioral.test.ts',
];

if (!Number.isFinite(minimumExecuted) || minimumExecuted < 1) {
  throw new Error(`RLS_MIN_EXECUTED_TESTS must be a positive number, received: ${process.env.RLS_MIN_EXECUTED_TESTS}`);
}

const vitestArgs = [
  'vitest',
  'run',
  '--config',
  'tests/security/vitest.security.config.ts',
  '--project',
  suiteLabel,
  ...rlsSpecs,
  '--reporter=verbose',
  '--reporter=junit',
  '--reporter=json',
  `--outputFile.junit=${reportJunitPath}`,
  `--outputFile.json=${reportPath}`,
];

// Never accept a stale report from an earlier invocation as test evidence.
fs.rmSync(reportPath, { force: true });
const vitest = spawnSync('npx', vitestArgs, { stdio: 'inherit', env: process.env });

if (!fs.existsSync(reportPath)) {
  console.error(`ERROR: RLS test report not found at ${reportPath}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
} catch (error) {
  console.error(`ERROR: RLS test report is invalid JSON: ${error?.message || error}`);
  process.exit(1);
}
const executed = Number(report.numTotalTests ?? 0);
const passed = Number(report.numPassedTests ?? 0);
const failed = Number(report.numFailedTests ?? 0);
if (![executed, passed, failed].every((n) => Number.isSafeInteger(n) && n >= 0)) {
  console.error('ERROR: invalid RLS test counts in Vitest JSON report');
  process.exit(1);
}
const summaryLine = `RLS_EXECUTION_SUMMARY suite=${suiteLabel} expected_min=${minimumExecuted} actual_executed=${executed} passed=${passed}`;

console.log(summaryLine);

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `\n- ${summaryLine}\n`,
    'utf8',
  );
}

if (executed < minimumExecuted || passed < minimumExecuted || failed > 0) {
  console.error(`ERROR: ${suiteLabel} requires at least ${minimumExecuted} passing tests, zero failed tests (executed=${executed}, passed=${passed}, failed=${failed}).`);
  process.exit(1);
}

if ((vitest.status ?? 1) !== 0) {
  process.exit(vitest.status ?? 1);
}
