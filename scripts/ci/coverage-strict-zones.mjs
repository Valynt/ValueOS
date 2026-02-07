#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const policyPath = path.join(root, '.quality', 'coverage-policy.json');
const coverageSummaryPath = path.join(root, 'coverage', 'coverage-summary.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function weekDelta(fromDate, toDate) {
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.max(0, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)));
}

function effectiveThreshold(minLinesPct, ratchet) {
  if (!ratchet?.enabled) return minLinesPct;

  const start = new Date(ratchet.start_date);
  if (Number.isNaN(start.getTime())) return minLinesPct;

  const weeks = weekDelta(start, new Date());
  const raised = minLinesPct + weeks * (ratchet.increase_lines_pct ?? 0);
  return Math.min(raised, ratchet.max_lines_pct ?? raised);
}

if (!fs.existsSync(policyPath)) {
  console.error(`❌ Missing coverage policy: ${policyPath}`);
  process.exit(1);
}

if (!fs.existsSync(coverageSummaryPath)) {
  console.error('❌ Missing coverage summary at coverage/coverage-summary.json');
  process.exit(1);
}

const policy = readJson(policyPath);
const summary = readJson(coverageSummaryPath);
const strictZones = policy.strict_zones ?? [];

if (!strictZones.length) {
  console.log('⚠️ No strict zones configured for coverage enforcement.');
  process.exit(0);
}

const files = Object.entries(summary)
  .filter(([key]) => key !== 'total')
  .map(([filePath, value]) => ({ filePath, value }));

const rows = [];
let failed = false;

for (const zone of strictZones) {
  const zonePath = zone.path.replace(/\\/g, '/');
  const matching = files.filter(({ filePath }) => filePath.replace(/\\/g, '/').includes(zonePath));

  const covered = matching.reduce((acc, { value }) => acc + (value?.lines?.covered ?? 0), 0);
  const total = matching.reduce((acc, { value }) => acc + (value?.lines?.total ?? 0), 0);
  const pct = total > 0 ? Number(((covered / total) * 100).toFixed(2)) : 0;

  const threshold = effectiveThreshold(zone.min_lines_pct, policy.ratchet);
  const ok = pct >= threshold;
  if (!ok) failed = true;

  rows.push({
    zone: zone.name,
    path: zone.path,
    threshold,
    linesPct: pct,
    files: matching.length,
    status: ok ? 'pass' : 'fail',
  });
}

const baseline = {
  generated_at: new Date().toISOString(),
  total_lines_pct: summary?.total?.lines?.pct ?? 0,
  ratchet: policy.ratchet ?? null,
  strict_zones: rows,
};

fs.mkdirSync(path.join(root, 'coverage'), { recursive: true });
fs.writeFileSync(path.join(root, 'coverage', 'strict-zone-summary.json'), JSON.stringify(baseline, null, 2));

const markdown = [
  '# Coverage baseline summary',
  '',
  `- Generated: ${baseline.generated_at}`,
  `- Total lines coverage: ${baseline.total_lines_pct}%`,
  '',
  '| Zone | Path | Lines % | Threshold % | Files | Status |',
  '|---|---|---:|---:|---:|---|',
  ...rows.map((r) => `| ${r.zone} | \`${r.path}\` | ${r.linesPct} | ${r.threshold} | ${r.files} | ${r.status === 'pass' ? '✅ pass' : '❌ fail'} |`),
  '',
  '> Ratchet: threshold increases weekly based on `.quality/coverage-policy.json`.',
  '',
].join('\n');

fs.writeFileSync(path.join(root, 'coverage', 'baseline-summary.md'), markdown);

console.log(markdown);

if (failed) {
  console.error('❌ Strict-zone coverage thresholds failed.');
  process.exit(1);
}

console.log('✅ Strict-zone coverage thresholds passed.');
