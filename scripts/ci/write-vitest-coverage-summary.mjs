#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function arg(name) {
  const prefix = `${name}=`;
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) {
    return process.argv[exactIndex + 1];
  }
  const inline = process.argv.find((value) => value.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : undefined;
}

const packageId = arg('--package-id');
const packageLabel = arg('--package-label');
const packageDir = arg('--package-dir');
const coverageSummaryPath = arg('--coverage-summary');
const outputPath = arg('--output');

if (!packageId || !packageLabel || !packageDir || !coverageSummaryPath || !outputPath) {
  console.error('❌ Missing required arguments for write-vitest-coverage-summary.mjs');
  process.exit(1);
}

const summary = JSON.parse(readFileSync(coverageSummaryPath, 'utf8'));
const total = summary.total ?? {};
const metrics = [
  ['Lines', total.lines],
  ['Statements', total.statements],
  ['Functions', total.functions],
  ['Branches', total.branches],
];

const markdown = [
  `## ${packageLabel}`,
  '',
  `- package_dir: \`${packageDir}\``,
  `- coverage_summary: \`${coverageSummaryPath}\``,
  '',
  '| Metric | Covered / Total | Percent |',
  '| --- | ---: | ---: |',
  ...metrics.map(([label, value]) => `| ${label} | ${value?.covered ?? 0} / ${value?.total ?? 0} | ${(value?.pct ?? 0).toFixed(2)}% |`),
  '',
].join('\n');

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, markdown);
console.log(`✅ Wrote coverage summary for ${packageId} to ${outputPath}`);
