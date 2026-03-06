#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);

const getArg = (name, fallback) => {
  const prefixed = `${name}=`;
  const token = args.find((arg) => arg.startsWith(prefixed));
  return token ? token.slice(prefixed.length) : fallback;
};

const budgetFile = getArg('--budgets', 'infra/observability/query-fingerprint-budgets.json');
const snapshotFile = getArg('--snapshot', 'infra/observability/query-fingerprint-latest.json');

const root = process.cwd();

const [budgetRaw, snapshotRaw] = await Promise.all([
  readFile(path.resolve(root, budgetFile), 'utf8'),
  readFile(path.resolve(root, snapshotFile), 'utf8'),
]);

const budgetDoc = JSON.parse(budgetRaw);
const snapshotDoc = JSON.parse(snapshotRaw);

if (!Array.isArray(budgetDoc.fingerprints) || budgetDoc.fingerprints.length === 0) {
  console.error(`❌ No fingerprints configured in ${budgetFile}.`);
  process.exit(1);
}

if (!Array.isArray(snapshotDoc.fingerprints) || snapshotDoc.fingerprints.length === 0) {
  console.error(`❌ No fingerprint samples found in ${snapshotFile}.`);
  process.exit(1);
}

const snapshotByFingerprint = new Map(
  snapshotDoc.fingerprints.map((item) => [item.fingerprint, item]),
);

const failures = [];
const warnings = [];

for (const budget of budgetDoc.fingerprints) {
  const observed = snapshotByFingerprint.get(budget.fingerprint);

  if (!observed) {
    failures.push(`Missing fingerprint \"${budget.fingerprint}\" in snapshot.`);
    continue;
  }

  if (observed.mean_exec_time_ms > budget.max_mean_exec_time_ms) {
    failures.push(
      `${budget.fingerprint}: mean_exec_time_ms ${observed.mean_exec_time_ms} > budget ${budget.max_mean_exec_time_ms}`,
    );
  }

  if (observed.total_exec_time_ms > budget.max_total_exec_time_ms) {
    failures.push(
      `${budget.fingerprint}: total_exec_time_ms ${observed.total_exec_time_ms} > budget ${budget.max_total_exec_time_ms}`,
    );
  }

  if (observed.calls > budget.max_calls) {
    failures.push(
      `${budget.fingerprint}: calls ${observed.calls} > budget ${budget.max_calls}`,
    );
  }
}

for (const observed of snapshotDoc.fingerprints) {
  if (!budgetDoc.fingerprints.some((budget) => budget.fingerprint === observed.fingerprint)) {
    warnings.push(`Observed fingerprint without budget: ${observed.fingerprint}`);
  }
}

if (warnings.length > 0) {
  for (const warning of warnings) {
    console.warn(`⚠️ ${warning}`);
  }
}

if (failures.length > 0) {
  console.error('❌ Query fingerprint budget gate failed.');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log(
  `✅ Query fingerprint budget gate passed for ${budgetDoc.fingerprints.length} configured fingerprint(s) using ${snapshotFile}.`,
);
