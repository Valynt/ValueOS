#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const baselinePath = path.join(repoRoot, 'config/valyntapp-ts-error-baseline.json');

const args = new Set(process.argv.slice(2));
const enforce = args.has('--enforce');
const updateBaseline = args.has('--update-baseline');
const reportOnly = args.has('--report-only');
const reportArg = process.argv.find((arg) => arg.startsWith('--report-file='));
const reportFile = reportArg
  ? path.resolve(repoRoot, reportArg.replace('--report-file=', ''))
  : path.join(repoRoot, 'artifacts/ci-lanes/ts-type-ratchet/valyntapp-ts-error-weekly.md');

if (!fs.existsSync(baselinePath)) {
  console.error(`Missing baseline artifact: ${baselinePath}`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

function toMonthIndex(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 0;
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function parseErrors(tscOutput) {
  const byCode = new Map();
  const byFile = new Map();
  let total = 0;

  for (const rawLine of tscOutput.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^([^(]+)\(\d+,\d+\): error (TS\d+):/);
    if (!match) continue;

    total += 1;
    const file = match[1].replaceAll('\\\\', '/').trim();
    const code = match[2];

    byCode.set(code, (byCode.get(code) ?? 0) + 1);
    byFile.set(file, (byFile.get(file) ?? 0) + 1);
  }

  return {
    total,
    byCode: Object.fromEntries([...byCode.entries()].sort((a, b) => b[1] - a[1])),
    byFile: Object.fromEntries([...byFile.entries()].sort((a, b) => b[1] - a[1])),
  };
}

function runValyntTypecheck() {
  try {
    execSync('pnpm --filter valynt-app exec tsc --noEmit --pretty false', {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return '';
  } catch (error) {
    return String(error.stdout ?? '');
  }
}

function topEntries(record, limit = 10) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function buildChurn(currentByFile, baselineByFile) {
  const churn = [];
  const files = new Set([...Object.keys(currentByFile), ...Object.keys(baselineByFile)]);
  for (const file of files) {
    const before = Number(baselineByFile[file] ?? 0);
    const now = Number(currentByFile[file] ?? 0);
    const delta = now - before;
    if (delta !== 0) {
      churn.push({ file, before, now, delta });
    }
  }

  return churn
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 15);
}

const tscOutput = runValyntTypecheck();
const metrics = parseErrors(tscOutput);
const current = metrics.total;
const baselineCount = Number(baseline.baseline ?? 0);
const reductionPolicy = baseline.policy?.monthlyReductionTargetPercent ?? { min: 10, max: 15 };
const minPct = Number(reductionPolicy.min ?? 10);
const maxPct = Number(reductionPolicy.max ?? 15);
const nextTargetConservative = Math.floor(baselineCount * (1 - minPct / 100));
const nextTargetAggressive = Math.floor(baselineCount * (1 - maxPct / 100));
const monthsElapsed = Math.max(0, toMonthIndex(new Date().toISOString()) - toMonthIndex(baseline.capturedAt));

const hasBaselineSnapshot = Boolean(baseline.lastSnapshot?.byFile);
const baselineByFile = hasBaselineSnapshot ? baseline.lastSnapshot.byFile : {};
const churn = hasBaselineSnapshot ? buildChurn(metrics.byFile, baselineByFile) : [];

const reportLines = [
  '# ValyntApp TypeScript Debt Weekly Report',
  '',
  `- Generated: ${new Date().toISOString()}`,
  `- Package: ${baseline.package ?? 'apps/ValyntApp'}`,
  `- Baseline: ${baselineCount}`,
  `- Current: ${current}`,
  `- Net change: ${current - baselineCount >= 0 ? '+' : ''}${current - baselineCount}`,
  '',
  '## Ratchet status',
  '',
  current > baselineCount
    ? `- ❌ Regression: current errors exceed baseline by ${current - baselineCount}.`
    : '- ✅ No net-new TypeScript errors versus baseline.',
  '',
  '## Monthly reduction targets (10–15%)',
  '',
  `- Conservative target (-${minPct}%): ${nextTargetConservative}`,
  `- Aggressive target (-${maxPct}%): ${nextTargetAggressive}`,
  `- Months since baseline capture: ${monthsElapsed}`,
  '',
  '## Top error categories (TS codes)',
  '',
  '| Code | Count |',
  '| --- | ---: |',
  ...topEntries(metrics.byCode, 15).map(([code, count]) => `| ${code} | ${count} |`),
  '',
  '## Highest-churn files',
  '',
  '| File | Baseline | Current | Δ |',
  '| --- | ---: | ---: | ---: |',
  ...(churn.length
    ? churn.map(({ file, before, now, delta }) =>
        `| ${file} | ${before} | ${now} | ${delta >= 0 ? '+' : ''}${delta} |`
      )
    : ['| _No baseline snapshot in config/valyntapp-ts-error-baseline.json yet_ | 0 | 0 | 0 |']),
  '',
  '## Top files by current error volume',
  '',
  '| File | Count |',
  '| --- | ---: |',
  ...topEntries(metrics.byFile, 15).map(([file, count]) => `| ${file} | ${count} |`),
  '',
];

fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, `${reportLines.join('\n')}\n`);

const snapshot = {
  generatedAt: new Date().toISOString(),
  baseline: baselineCount,
  current,
  netChange: current - baselineCount,
  topCodes: topEntries(metrics.byCode, 25),
  topFiles: topEntries(metrics.byFile, 25),
  churn,
};
const jsonReportFile = reportFile.replace(/\.md$/u, '.json');
fs.writeFileSync(jsonReportFile, `${JSON.stringify(snapshot, null, 2)}\n`);

console.log(`ValyntApp TypeScript errors: ${current} (baseline: ${baselineCount})`);
console.log(`Weekly report written to ${path.relative(repoRoot, reportFile)}`);

if (updateBaseline) {
  const updated = {
    ...baseline,
    baseline: current,
    capturedAt: new Date().toISOString().slice(0, 10),
    lastSnapshot: {
      byCode: metrics.byCode,
      byFile: metrics.byFile,
    },
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`Updated baseline artifact at ${path.relative(repoRoot, baselinePath)}.`);
}

if (!reportOnly && enforce && current > baselineCount) {
  console.error('ValyntApp TypeScript ratchet failed: net-new errors detected.');
  process.exit(1);
}
