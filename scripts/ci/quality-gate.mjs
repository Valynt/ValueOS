#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const baselinePath = path.join(projectRoot, '.quality', 'baselines.json');

function runStep(name, cmd, { allowFailure = false } = {}) {
  console.log(`\n▶ ${name}`);
  console.log(`$ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    return { ok: true };
  } catch (error) {
    if (!allowFailure) throw error;
    return { ok: false, error };
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function compareMetric({ label, current, baseline, prefer = 'lower' }) {
  const ok = prefer === 'lower' ? current <= baseline : current >= baseline;
  const direction = prefer === 'lower' ? '≤' : '≥';
  const delta = Number((current - baseline).toFixed(2));
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${label}: current=${current}, baseline=${baseline}, target: ${direction} baseline, delta=${delta}`);
  return ok;
}

function getTodoFixmeCount(strictZones) {
  const existingZones = strictZones.filter((zone) => fs.existsSync(path.join(projectRoot, zone)));

  if (!existingZones.length) {
    console.warn('⚠️ No strict-zone paths exist on disk; TODO/FIXME count defaults to 0.');
    return { count: 0, matches: [] };
  }

  const cmd = [
    'rg --no-heading --line-number --color=never "TODO|FIXME"',
    '--glob=!**/node_modules/**',
    '--glob=!**/.git/**',
    '--glob=!**/dist/**',
    '--glob=!**/coverage/**',
    ...existingZones.map((zone) => `"${zone}"`),
  ].join(' ');

  try {
    const output = execSync(cmd, { encoding: 'utf8' }).trim();
    const matches = output ? output.split('\n') : [];
    return { count: matches.length, matches };
  } catch (error) {
    const output = error.stdout?.toString().trim();
    if (!output) return { count: 0, matches: [] };
    const matches = output.split('\n');
    return { count: matches.length, matches };
  }
}

function failWithHelp(messages) {
  console.error('\n💥 Quality gate failed. Action plan:');
  messages.forEach((msg) => console.error(`   - ${msg}`));
  process.exit(1);
}

const baseline = readJson(baselinePath);
const strictZoneConfig = readJson(path.join(projectRoot, 'config', 'strict-zones.json'));
const strictZones = strictZoneConfig.strict_zones ?? [];

const lint = runStep('Lint status', 'pnpm run lint', { allowFailure: true });
runStep('TypeScript telemetry', 'pnpm run typecheck:signal --json');
const tests = runStep(
  'Unit tests with coverage summary',
  'pnpm run test:unit -- --coverage --coverage.reporter=json-summary --coverage.reporter=text',
  { allowFailure: true }
);

const telemetry = readJson(path.join(projectRoot, '.typecheck-telemetry.json'));
const coveragePath = path.join(projectRoot, 'coverage', 'coverage-summary.json');
const coverage = fs.existsSync(coveragePath) ? readJson(coveragePath) : null;

const tsErrors = telemetry.totalErrors;
const lineCoverage = coverage?.total?.lines?.pct ?? 0;
const { count: todoFixmeCount, matches } = getTodoFixmeCount(strictZones);

console.log('\n══════════ Quality KPI Summary ══════════');
console.log(`Lint status: ${lint.ok ? 'PASS ✅' : 'FAIL ❌'}`);
console.log(`Test status: ${tests.ok ? 'PASS ✅' : 'FAIL ❌'}`);

const checks = [
  compareMetric({ label: 'TypeScript error count', current: tsErrors, baseline: baseline.tsErrors, prefer: 'lower' }),
  compareMetric({ label: 'Coverage (lines %)', current: lineCoverage, baseline: baseline.coverage.linesPct, prefer: 'higher' }),
  compareMetric({ label: 'TODO/FIXME in strict zones', current: todoFixmeCount, baseline: baseline.todoFixme.strictZones, prefer: 'lower' }),
];

if (matches.length > 0) {
  console.log('\nStrict-zone TODO/FIXME matches (first 10):');
  matches.slice(0, 10).forEach((line) => console.log(`  - ${line}`));
}

const failures = [];
if (!lint.ok) failures.push('Lint failed. Run `pnpm run lint` locally and fix ESLint violations before merging.');
if (!tests.ok) failures.push('Tests failed. Run `pnpm run test:unit -- --coverage` locally and fix failing tests.');
if (!coverage) failures.push('Coverage summary was not generated. Ensure unit tests run with `--coverage.reporter=json-summary`.');
if (!checks[0]) failures.push('TypeScript error count regressed. Reduce errors or intentionally re-baseline by updating .quality/baselines.json in a dedicated debt-management PR.');
if (!checks[1]) failures.push('Coverage dropped below baseline. Add tests for changed code paths or improve existing tests to recover line coverage.');
if (!checks[2]) failures.push('TODO/FIXME count increased in strict zones. Resolve comments or move debt tracking to an issue before merging.');

if (failures.length) failWithHelp(failures);

console.log('\n🎉 Quality gate passed.');
