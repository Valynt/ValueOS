#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, 'config', 'debt-budgets.json');
const pattern = '(:\\s*any\\b|as\\s+any\\b|<\\s*any\\s*>)';

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const entries = Array.isArray(config.entries) ? config.entries : [];

function run(command, cwd = repoRoot) {
  try {
    return {
      ok: true,
      stdout: execSync(command, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
      stderr: '',
    };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout ?? ''),
      stderr: String(error.stderr ?? ''),
    };
  }
}

function countExplicitAny(entry) {
  const targetPath = entry.path;
  const args = ['-n', pattern, targetPath];

  if (!entry.includeTests) {
    args.push('--glob', '!**/*.test.*', '--glob', '!**/*.spec.*', '--glob', '!**/__tests__/**');
  }

  const result = run(`rg ${args.map((arg) => `'${arg.replaceAll("'", "'\\''")}'`).join(' ')}`);
  if (!result.ok && !result.stdout && !result.stderr) {
    return 0;
  }
  const combined = `${result.stdout}\n${result.stderr}`.trim();
  if (!combined) {
    return 0;
  }
  if (!result.ok && /No files were searched|No such file or directory/.test(combined)) {
    throw new Error(`Unable to scan explicit-any budget path: ${targetPath}\n${combined}`);
  }
  return result.stdout.split('\n').map((line) => line.trim()).filter(Boolean).length;
}

function countTypeScriptErrors(entry) {
  const result = run(entry.command);
  const combined = `${result.stdout}\n${result.stderr}`;
  return combined.split('\n').filter((line) => /error TS\d+:/.test(line)).length;
}

function countEslintWarnings(entry) {
  const tmpFile = path.join(os.tmpdir(), `valueos-eslint-${entry.id}-${process.pid}.json`);
  const command = `${entry.command} -o '${tmpFile}'`;
  const result = run(command);
  if (!fs.existsSync(tmpFile)) {
    throw new Error(`ESLint report was not generated for ${entry.id}.\n${result.stderr || result.stdout}`);
  }
  const report = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
  fs.unlinkSync(tmpFile);
  return report.reduce((sum, file) => sum + Number(file.warningCount ?? 0), 0);
}

function measure(entry) {
  switch (entry.metric) {
    case 'explicitAny':
      return countExplicitAny(entry);
    case 'tsErrors':
      return countTypeScriptErrors(entry);
    case 'eslintWarnings':
      return countEslintWarnings(entry);
    default:
      throw new Error(`Unsupported debt metric: ${entry.metric}`);
  }
}

const bucketTotals = new Map();
let regressions = 0;

console.log('Debt ratchet status');
for (const entry of entries) {
  const current = measure(entry);
  const baseline = Number(entry.baseline ?? 0);
  const nextTarget = Number(entry.nextTarget ?? baseline);
  const delta = current - baseline;
  const status = current <= baseline ? '✅' : '❌';
  console.log(`${status} [${entry.bucket}] ${entry.label}: current=${current}, baseline=${baseline}, delta=${delta >= 0 ? '+' : ''}${delta}, nextTarget=${nextTarget}`);
  if (current > baseline) {
    regressions += 1;
  }
  const bucket = bucketTotals.get(entry.bucket) ?? { current: 0, baseline: 0 };
  bucket.current += current;
  bucket.baseline += baseline;
  bucketTotals.set(entry.bucket, bucket);
}

console.log('\nBucket totals');
for (const [bucket, totals] of bucketTotals.entries()) {
  const status = totals.current <= totals.baseline ? '✅' : '❌';
  const delta = totals.current - totals.baseline;
  console.log(`${status} ${bucket}: current=${totals.current}, baseline=${totals.baseline}, delta=${delta >= 0 ? '+' : ''}${delta}`);
  if (totals.current > totals.baseline) {
    regressions += 1;
  }
}

if (regressions > 0) {
  console.error(`Debt ratchet regression detected in ${regressions} entry/bucket check(s).`);
  process.exit(1);
}
