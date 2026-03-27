#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { listAllCheckRuns, parseRepository } from './release-manifest-lib.mjs';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function readIndicatorConfig() {
  const cfgPath = path.resolve('config/release-risk/reliability-indicators.json');
  if (!fs.existsSync(cfgPath)) {
    throw new Error(`Missing reliability indicator config: ${cfgPath}`);
  }

  return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
}

function parseLatestDrillDate(markdownPath) {
  const content = fs.readFileSync(markdownPath, 'utf8');
  const matches = [...content.matchAll(/\|\s*(\d{4}-\d{2}-\d{2})\s*\|/g)].map((m) => m[1]);
  if (matches.length === 0) {
    throw new Error(`No drill dates found in ${markdownPath}`);
  }

  return matches.sort().reverse()[0];
}

function daysBetween(isoDate, now = new Date()) {
  const then = new Date(`${isoDate}T00:00:00Z`);
  const diff = now.getTime() - then.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

async function main() {
  const token = requiredEnv('GITHUB_TOKEN');
  const repository = requiredEnv('GITHUB_REPOSITORY');
  const sha = requiredEnv('GITHUB_SHA');

  const cfg = readIndicatorConfig();
  const reliability = cfg.releaseGate?.reliabilityIndicators ?? {};
  const criticalChecks = Array.isArray(reliability.criticalChecks) ? reliability.criticalChecks : [];
  const minCriticalPassRate = Number(reliability.minimumCriticalPassRatePercent ?? 100);
  const maxFlakyRate = Number(reliability.maximumFlakyRatePercent ?? 2);
  const maxRollbackDrillAgeDays = Number(reliability.rollbackDrillRecencyDays ?? 30);
  const flakeCheckName = String(reliability.flakyCheckName ?? 'flake-gate');

  if (criticalChecks.length === 0) {
    throw new Error('Reliability indicator config has no criticalChecks entries.');
  }

  const { owner, repo } = parseRepository(repository);
  const checkRuns = await listAllCheckRuns({ owner, repo, sha, token });
  const byName = new Map(checkRuns.map((run) => [run.name, run]));

  let passedCritical = 0;
  const missingCritical = [];
  for (const name of criticalChecks) {
    const run = byName.get(name);
    if (!run) {
      missingCritical.push(name);
      continue;
    }
    if (run.status === 'completed' && run.conclusion === 'success') {
      passedCritical += 1;
    }
  }

  const consideredCritical = criticalChecks.length - missingCritical.length;
  const criticalPassRate = consideredCritical > 0
    ? Number(((passedCritical / consideredCritical) * 100).toFixed(2))
    : 0;

  console.log(`Critical checks configured: ${criticalChecks.join(', ')}`);
  if (missingCritical.length > 0) {
    console.log(`Missing critical checks for this SHA: ${missingCritical.join(', ')}`);
  }
  console.log(`Critical pass rate: ${criticalPassRate}% (required >= ${minCriticalPassRate}%)`);

  const flakeRun = byName.get(flakeCheckName);
  let flakyRate = 100;
  if (flakeRun?.status === 'completed' && flakeRun.conclusion === 'success') {
    flakyRate = 0;
  }
  console.log(`Flaky threshold proxy: ${flakeCheckName} => rate ${flakyRate}% (required <= ${maxFlakyRate}%)`);

  const drillLogPath = path.resolve('docs/operations/on-call-drill-scorecard.md');
  const latestDrillDate = parseLatestDrillDate(drillLogPath);
  const drillAgeDays = daysBetween(latestDrillDate);
  console.log(`Latest rollback/on-call drill: ${latestDrillDate} (${drillAgeDays} days ago, required <= ${maxRollbackDrillAgeDays})`);

  const failures = [];
  if (missingCritical.length > 0) {
    failures.push(`Missing critical checks: ${missingCritical.join(', ')}`);
  }
  if (criticalPassRate < minCriticalPassRate) {
    failures.push(`Critical pass rate ${criticalPassRate}% is below ${minCriticalPassRate}%`);
  }
  if (flakyRate > maxFlakyRate) {
    failures.push(`Flaky rate ${flakyRate}% is above ${maxFlakyRate}%`);
  }
  if (drillAgeDays > maxRollbackDrillAgeDays) {
    failures.push(`Rollback drill recency ${drillAgeDays}d exceeds ${maxRollbackDrillAgeDays}d`);
  }

  if (failures.length > 0) {
    console.error('❌ Release reliability indicators failed:');
    for (const item of failures) {
      console.error(`- ${item}`);
    }
    process.exit(1);
  }

  console.log('✅ Release reliability indicators satisfied.');
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
