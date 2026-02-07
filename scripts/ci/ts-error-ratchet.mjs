#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const baselinePath = path.join(projectRoot, '.quality', 'tsc-baseline.json');

const tsc = spawnSync('pnpm', ['exec', 'tsc', '--noEmit', '--pretty', 'false'], {
  cwd: projectRoot,
  encoding: 'utf8',
});

const output = `${tsc.stdout ?? ''}\n${tsc.stderr ?? ''}`;
const count = (output.match(/error TS\d+:/g) ?? []).length;

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const baselineCount = Number(baseline.errorCount ?? 0);
const result = {
  measuredAt: new Date().toISOString(),
  command: 'pnpm exec tsc --noEmit --pretty false',
  errorCount: count,
  baselineErrorCount: baselineCount,
};

console.log(JSON.stringify(result, null, 2));

if (count > baselineCount) {
  console.error(`❌ TypeScript error count regressed: ${count} > baseline ${baselineCount}`);
  process.exit(1);
}

if (count < baselineCount) {
  console.log(`🎉 TypeScript error count improved: ${count} < baseline ${baselineCount}`);
  process.exit(0);
}

console.log(`✅ TypeScript error count unchanged: ${count}`);
