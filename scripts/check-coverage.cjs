#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const cfg = {
    summary: 'coverage/unit/coverage-summary.json',
    thresholds: 'config/coverage-thresholds.json',
    baseline: 'config/coverage-baseline.json',
  };

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--summary') cfg.summary = args[i + 1];
    if (args[i] === '--thresholds') cfg.thresholds = args[i + 1];
    if (args[i] === '--baseline') cfg.baseline = args[i + 1];
  }

  return cfg;
}

function readJson(filePath, required = true) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    if (!required) return null;
    console.error(`Required file not found: ${filePath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function linesPct(entry) {
  const pct = entry?.lines?.pct;
  return typeof pct === "number" && Number.isFinite(pct) ? pct : 0;
}

function aggregateLines(summary, targetPaths) {
  const keys = Object.keys(summary).filter(
    (k) => k !== 'total' && targetPaths.some((p) => k.includes(p)),
  );

  if (keys.length === 0) return { pct: null, covered: 0, total: 0, files: 0 };

  let covered = 0;
  let total = 0;
  for (const key of keys) {
    const lines = summary[key]?.lines;
    if (typeof lines?.covered === 'number' && typeof lines?.total === 'number') {
      covered += lines.covered;
      total += lines.total;
    }
  }

  const pct = total > 0 ? Number(((covered / total) * 100).toFixed(2)) : 0;
  return { pct, covered, total, files: keys.length };
}

function main() {
  const args = parseArgs();
  const summary = readJson(args.summary);
  const thresholds = readJson(args.thresholds);
  const baseline = readJson(args.baseline, false) || { strict_zones: {} };

  const overall = linesPct(summary.total);
  const overallMin = thresholds.minimums?.overall_lines ?? 0;
  console.log(`Overall lines coverage: ${overall}% (minimum ${overallMin}%)`);
  if (overall < overallMin) {
    console.error(`Overall lines coverage ${overall}% below minimum ${overallMin}%`);
    process.exit(2);
  }

  const strictMin = thresholds.minimums?.strict_zone_lines ?? 60;
  const errors = [];

  for (const zone of thresholds.strict_zones || []) {
    const result = aggregateLines(summary, zone.paths || []);
    if (result.pct === null) {
      console.log(`Skipping ${zone.name}: no instrumented files matched (${(zone.paths || []).join(', ')})`);
      continue;
    }

    const baselineValue = Number(baseline.strict_zones?.[zone.name] ?? strictMin);
    const required = Math.max(strictMin, baselineValue);
    console.log(`${zone.name}: ${result.pct}% lines (${result.covered}/${result.total}), required ${required}%`);

    if (result.pct < required) {
      errors.push(`${zone.name} ${result.pct}% < ${required}%`);
    }
  }

  if (errors.length > 0) {
    console.error('Coverage threshold failure(s):');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(2);
  }

  console.log('Coverage thresholds passed.');
}

main();
