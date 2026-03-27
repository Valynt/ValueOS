#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

function getArg(flag, defaultValue) {
  const idx = args.indexOf(flag);
  if (idx === -1) return defaultValue;
  return args[idx + 1];
}

function requireArg(flag) {
  const value = getArg(flag);
  if (!value) {
    throw new Error(`Missing required argument: ${flag}`);
  }
  return value;
}

function flattenPlaywrightTests(suite) {
  const tests = [];
  const stack = [suite];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;

    if (Array.isArray(current.tests)) {
      for (const test of current.tests) {
        tests.push(test);
      }
    }

    if (Array.isArray(current.suites)) {
      for (const child of current.suites) {
        stack.push(child);
      }
    }

    if (Array.isArray(current.specs)) {
      for (const spec of current.specs) {
        stack.push(spec);
      }
    }
  }

  return tests;
}

function parseVitest(report) {
  return {
    executed: Number(report.numTotalTests ?? 0),
    passed: Number(report.numPassedTests ?? 0),
  };
}

function parsePlaywright(report) {
  const tests = flattenPlaywrightTests(report);
  let executed = 0;
  let passed = 0;

  for (const test of tests) {
    const outcomes = Array.isArray(test.results) ? test.results : [];
    const hasResult = outcomes.length > 0;
    if (hasResult) executed += 1;

    const success = outcomes.some((result) => result.status === 'passed');
    if (success) passed += 1;
  }

  return { executed, passed };
}

function main() {
  const reportPath = requireArg('--report');
  const format = requireArg('--format');
  const minExecuted = Number(getArg('--min-executed', '1'));
  const minPassRate = Number(getArg('--min-pass-rate', '100'));
  const label = getArg('--label', format);

  if (!Number.isFinite(minExecuted) || minExecuted < 1) {
    throw new Error('--min-executed must be a positive number');
  }

  if (!Number.isFinite(minPassRate) || minPassRate < 0 || minPassRate > 100) {
    throw new Error('--min-pass-rate must be between 0 and 100');
  }

  const absolutePath = path.resolve(reportPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Report not found: ${absolutePath}`);
  }

  const report = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  const metrics = format === 'playwright' ? parsePlaywright(report) : parseVitest(report);

  const passRate = metrics.executed > 0
    ? Number(((metrics.passed / metrics.executed) * 100).toFixed(2))
    : 0;

  console.log(`${label} executed=${metrics.executed} passed=${metrics.passed} passRate=${passRate}%`);

  if (metrics.executed < minExecuted) {
    throw new Error(`${label}: executed test count ${metrics.executed} is below required minimum ${minExecuted}`);
  }

  if (passRate < minPassRate) {
    throw new Error(`${label}: pass rate ${passRate}% is below required minimum ${minPassRate}%`);
  }

  console.log(`✅ ${label} test minimums satisfied.`);
}

main();
