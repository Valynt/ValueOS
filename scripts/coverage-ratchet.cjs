#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const thresholdsPath = path.resolve('config/coverage-thresholds.json');
const baselinePath = path.resolve('config/coverage-baseline.json');
const summaryPath = path.resolve('coverage/unit/coverage-summary.json');

if (!fs.existsSync(thresholdsPath) || !fs.existsSync(baselinePath) || !fs.existsSync(summaryPath)) {
  console.error('Missing thresholds, baseline, or coverage summary file.');
  process.exit(1);
}

const thresholds = JSON.parse(fs.readFileSync(thresholdsPath, 'utf8'));
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

function aggregateLines(targetPaths) {
  const keys = Object.keys(summary).filter((k) => k !== 'total' && targetPaths.some((p) => k.includes(p)));
  let covered = 0;
  let total = 0;
  for (const key of keys) {
    covered += summary[key]?.lines?.covered || 0;
    total += summary[key]?.lines?.total || 0;
  }
  if (total === 0) return null;
  return Number(((covered / total) * 100).toFixed(2));
}

const step = Number(thresholds.ratchet?.weekly_step ?? 2);
const ceiling = Number(thresholds.ratchet?.max_lines ?? 80);
baseline.strict_zones = baseline.strict_zones || {};

for (const zone of thresholds.strict_zones || []) {
  const current = aggregateLines(zone.paths || []);
  if (current === null) continue;
  const existing = Number(baseline.strict_zones[zone.name] ?? thresholds.minimums?.strict_zone_lines ?? 60);
  const proposed = Math.min(ceiling, existing + step, Math.floor(current));
  baseline.strict_zones[zone.name] = Number(proposed.toFixed(2));
  console.log(`${zone.name}: ${existing}% -> ${baseline.strict_zones[zone.name]}% (current ${current}%)`);
}

baseline.updated_at = new Date().toISOString().slice(0, 10);
fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(`Updated ${baselinePath}`);
