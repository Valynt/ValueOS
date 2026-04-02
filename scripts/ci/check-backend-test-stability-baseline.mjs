#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const baselinePath = path.join(repoRoot, '.github/metrics/backend-test-stability-baseline.json');

function parseIsoDate(value, fieldName) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date for ${fieldName}: ${value}`);
  }
  return parsed;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function getLatestTarget(plan, referenceDate) {
  const sorted = [...plan].sort((a, b) => parseIsoDate(a.weekOf, 'burnDownPlan.weekOf') - parseIsoDate(b.weekOf, 'burnDownPlan.weekOf'));
  let selected = sorted[0] ?? null;

  for (const target of sorted) {
    const weekDate = parseIsoDate(target.weekOf, 'burnDownPlan.weekOf');
    if (weekDate <= referenceDate) {
      selected = target;
    }
  }

  return selected;
}

async function main() {
  const raw = await readFile(baselinePath, 'utf8');
  const policy = JSON.parse(raw);

  const baselineCount = Number(policy?.baseline?.failingTestCount);
  const baselineCeiling = Number(policy?.baseline?.ceiling);
  const measuredFailingCount = Number(process.env.VALUEOS_FAILING_TEST_COUNT ?? baselineCount);

  if (!Number.isFinite(baselineCount) || baselineCount < 0) {
    throw new Error('baseline.failingTestCount must be a non-negative number.');
  }

  if (!Number.isFinite(baselineCeiling) || baselineCeiling < 0) {
    throw new Error('baseline.ceiling must be a non-negative number.');
  }

  if (!Number.isFinite(measuredFailingCount) || measuredFailingCount < 0) {
    throw new Error('VALUEOS_FAILING_TEST_COUNT must be a non-negative number when provided.');
  }

  const today = parseIsoDate(process.env.VALUEOS_TEST_STABILITY_DATE ?? isoDate(new Date()), 'VALUEOS_TEST_STABILITY_DATE');
  const activeTarget = getLatestTarget(policy.burnDownPlan ?? [], today);

  if (!activeTarget) {
    throw new Error('burnDownPlan must include at least one weekly target.');
  }

  const activeCeiling = Number(activeTarget.maxFailingTests);
  if (!Number.isFinite(activeCeiling) || activeCeiling < 0) {
    throw new Error(`Invalid burnDownPlan maxFailingTests for week ${activeTarget.weekOf}.`);
  }

  if (activeCeiling > baselineCeiling) {
    throw new Error(
      `Invalid policy: active weekly ceiling (${activeCeiling}) cannot exceed baseline ceiling (${baselineCeiling}).`,
    );
  }

  if (measuredFailingCount > activeCeiling) {
    throw new Error(
      `Backend test stability regression: measured failing tests (${measuredFailingCount}) exceeds active weekly ceiling (${activeCeiling}) for week ${activeTarget.weekOf}.`,
    );
  }

  console.log('✅ Backend test stability baseline check passed.');
  console.log(`- Date: ${isoDate(today)}`);
  console.log(`- Active target week: ${activeTarget.weekOf}`);
  console.log(`- Allowed failing test ceiling: ${activeCeiling}`);
  console.log(`- Measured failing tests: ${measuredFailingCount}`);
}

main().catch((error) => {
  console.error('❌ Backend test stability baseline check failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
