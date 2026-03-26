#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();

function getArg(name, fallback = '') {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) {
    return process.argv[exactIndex + 1] ?? fallback;
  }
  const prefix = `${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  return fallback;
}

function readJsonAtCommit(commit, relativePath) {
  try {
    const output = execFileSync('git', ['show', `${commit}:${relativePath}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(output);
  } catch {
    return null;
  }
}

function readLocalJson(relativePath) {
  const absolutePath = path.resolve(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Ledger file not found: ${relativePath}`);
  }

  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function assertLedgerShape(ledger, ledgerPath) {
  if (!ledger || typeof ledger !== 'object') {
    throw new Error(`Invalid ledger in ${ledgerPath}: expected object root.`);
  }
  if (!Array.isArray(ledger.manifests)) {
    throw new Error(`Invalid ledger in ${ledgerPath}: manifests must be an array.`);
  }
}

function isEmpty(value) {
  return typeof value !== 'string' || value.trim().length === 0;
}

function normalizeStatus(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function runTransitionCheck() {
  const ledgerPath = getArg('--ledger-path', 'infra/k8s/manifest-maturity-ledger.json');
  const baseSha = getArg('--base-sha');
  const headSha = getArg('--head-sha') || 'HEAD';

  if (!baseSha) {
    throw new Error('--base-sha is required for transition-check mode.');
  }

  const currentLedger = readLocalJson(ledgerPath);
  assertLedgerShape(currentLedger, ledgerPath);

  const previousLedger = readJsonAtCommit(baseSha, ledgerPath);
  if (!previousLedger) {
    console.log(`No ${ledgerPath} file found at ${baseSha}; skipping Aspirational -> Validated transition checks.`);
    return;
  }

  assertLedgerShape(previousLedger, `${baseSha}:${ledgerPath}`);

  const previousByClass = new Map(previousLedger.manifests.map((entry) => [entry.class, entry]));
  const errors = [];

  for (const entry of currentLedger.manifests) {
    const previous = previousByClass.get(entry.class);
    if (!previous) {
      continue;
    }

    const previousStatus = normalizeStatus(previous.status);
    const currentStatus = normalizeStatus(entry.status);

    if (previousStatus !== 'aspirational' || currentStatus !== 'validated') {
      continue;
    }

    const evidence = entry.evidence ?? {};
    const missingEvidence = [];

    if (isEmpty(entry.status_owner)) {
      missingEvidence.push('status_owner');
    }
    if (isEmpty(entry.date_validated)) {
      missingEvidence.push('date_validated');
    }
    if (isEmpty(evidence.staging_deployment_result)) {
      missingEvidence.push('evidence.staging_deployment_result');
    }
    if (isEmpty(evidence.load_test_summary)) {
      missingEvidence.push('evidence.load_test_summary');
    }
    if (isEmpty(evidence.rollback_rehearsal)) {
      missingEvidence.push('evidence.rollback_rehearsal');
    }

    if (missingEvidence.length > 0) {
      errors.push(
        `Manifest class "${entry.class}" transitioned Aspirational -> Validated without required evidence fields: ${missingEvidence.join(', ')}`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`Manifest maturity transition checks failed:\n- ${errors.join('\n- ')}`);
  }

  console.log(`Manifest maturity transition checks passed for ${ledgerPath} (base ${baseSha}, head ${headSha}).`);
}

function runProductionGate() {
  const ledgerPath = getArg('--ledger-path', 'infra/k8s/manifest-maturity-ledger.json');
  const ledger = readLocalJson(ledgerPath);
  assertLedgerShape(ledger, ledgerPath);

  const blocking = ledger.manifests.filter((entry) => {
    if (!entry.critical) {
      return false;
    }
    return normalizeStatus(entry.status) !== 'validated';
  });

  if (blocking.length > 0) {
    const details = blocking
      .map((entry) => `${entry.class} (status=${entry.status}, owner=${entry.status_owner || 'unassigned'})`)
      .join('; ');

    throw new Error(
      `Production deployment blocked: critical manifest classes remain unvalidated in ${ledgerPath}: ${details}`,
    );
  }

  console.log(`Production manifest maturity gate passed: all critical classes are Validated in ${ledgerPath}.`);
}

function main() {
  const mode = getArg('--mode', 'transition-check');

  if (mode === 'transition-check') {
    runTransitionCheck();
    return;
  }

  if (mode === 'production-gate') {
    runProductionGate();
    return;
  }

  throw new Error(`Unsupported mode: ${mode}`);
}

main();
