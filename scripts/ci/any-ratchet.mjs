#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const baselinePath = path.join(repoRoot, '.quality', 'package-scorecard-baselines.json');

if (!fs.existsSync(baselinePath)) {
  console.error(`Missing package quality baseline file: ${baselinePath}`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valueos-any-ratchet-'));
const reportPath = path.join(tempDir, 'scorecard.json');

const result = spawnSync(
  'node',
  ['scripts/ci/package-quality-scorecard.mjs', '--json-out', reportPath],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  }
);

if (result.status !== 0) {
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  console.error(output);
  process.exit(result.status ?? 1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
let regressions = 0;

console.log('TypeScript any-usage ratchet status (per package)');

for (const pkg of report.packages) {
  const baselineAny = Number(baseline.packages?.[pkg.id]?.metrics?.anyCount ?? 0);
  const currentAny = Number(pkg.metrics.anyCount ?? 0);
  const nextTarget = pkg.ratchet?.nextTargets?.anyCount;

  if (currentAny > baselineAny) {
    regressions += 1;
    console.error(`❌ ${pkg.label}: ${currentAny} > baseline ${baselineAny}`);
  } else {
    console.log(`✅ ${pkg.label}: ${currentAny} <= baseline ${baselineAny}`);
  }

  if (typeof nextTarget === 'number' && currentAny > nextTarget) {
    console.warn(`⚠️ ${pkg.label}: ${currentAny} is above next target ${nextTarget}`);
  }
}

if (regressions > 0) {
  console.error(`Any-usage ratchet regression in ${regressions} package(s).`);
  process.exit(1);
}

console.log('Any-usage ratchet check passed (no regressions).');
