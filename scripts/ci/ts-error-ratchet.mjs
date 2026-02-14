#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const budgetPath = path.join(repoRoot, '.github/ts-error-ratchet-budgets.json');

if (!fs.existsSync(budgetPath)) {
  console.error(`Missing ratchet budget file: ${budgetPath}`);
  process.exit(1);
}

const budgets = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
const packageBudgets = budgets.packageBudgets ?? {};

function pkgFromFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if ((parts[0] === 'apps' || parts[0] === 'packages') && parts[1]) return `${parts[0]}/${parts[1]}`;
  return null;
}

let output = '';
try {
  execSync('pnpm exec tsc --noEmit --pretty false', { stdio: 'pipe', encoding: 'utf8' });
} catch (error) {
  output = String(error.stdout ?? '');
}

const byPackage = {};
for (const line of output.split('\n')) {
  const match = line.match(/^([^(]+)\(\d+,\d+\): error TS\d+:/);
  if (!match) continue;
  const pkg = pkgFromFile(match[1].trim());
  if (!pkg) continue;
  byPackage[pkg] = (byPackage[pkg] ?? 0) + 1;
}

let regressions = 0;
let missedTargets = 0;
console.log('TypeScript package ratchet status');
for (const [pkg, cfg] of Object.entries(packageBudgets)) {
  const current = byPackage[pkg] ?? 0;
  const budget = cfg.budget;
  const nextTarget = cfg.nextTarget;
  if (current > budget) {
    regressions += 1;
    console.error(`❌ ${pkg}: ${current} > budget ${budget}`);
  } else {
    console.log(`✅ ${pkg}: ${current} <= budget ${budget}`);
  }
  if (typeof nextTarget === 'number' && current > nextTarget) {
    missedTargets += 1;
    console.warn(`⚠️ ${pkg}: ${current} is above next target ${nextTarget}`);
  }
}

if (regressions > 0) {
  console.error(`Ratchet regression in ${regressions} package(s).`);
  process.exit(1);
}

if (missedTargets > 0) {
  console.log(`Incremental reduction pending for ${missedTargets} package(s); keep reducing toward nextTarget values.`);
}

console.log('TS error ratchet check passed (no regressions).');
