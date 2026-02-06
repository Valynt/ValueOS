#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const summaryPath = path.resolve(process.cwd(), 'coverage', 'unit', 'coverage-summary.json');
const outPath = path.resolve(process.cwd(), 'coverage', 'baseline-summary.md');

if (!fs.existsSync(summaryPath)) {
  console.error(`Coverage summary not found: ${summaryPath}`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const total = summary.total || {};
const now = new Date().toISOString();

const pct = (metric) => total[metric]?.pct ?? 0;

const lines = [
  '# Coverage Baseline (Unit Tests)',
  '',
  `Generated: ${now}`,
  '',
  '| Metric | Percent | Covered / Total |',
  '| --- | ---: | ---: |',
  `| Lines | ${pct('lines')}% | ${total.lines?.covered ?? 0} / ${total.lines?.total ?? 0} |`,
  `| Statements | ${pct('statements')}% | ${total.statements?.covered ?? 0} / ${total.statements?.total ?? 0} |`,
  `| Functions | ${pct('functions')}% | ${total.functions?.covered ?? 0} / ${total.functions?.total ?? 0} |`,
  `| Branches | ${pct('branches')}% | ${total.branches?.covered ?? 0} / ${total.branches?.total ?? 0} |`,
  ''
];

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'));
console.log(`Wrote baseline summary: ${outPath}`);
