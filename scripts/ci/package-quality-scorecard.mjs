#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, '.quality', 'package-scorecard.config.json');
const baselinePath = path.join(repoRoot, '.quality', 'package-scorecard-baselines.json');
const args = process.argv.slice(2);

const options = {
  verify: args.includes('--verify'),
  writeBaseline: args.includes('--write-baseline'),
  jsonOut: readArgValue('--json-out'),
  markdownOut: readArgValue('--markdown-out') ?? readArgValue('--md-out'),
  docsOut: readArgValue('--docs-out'),
};

function readArgValue(flag) {
  const direct = args.find((arg) => arg.startsWith(`${flag}=`));
  if (direct) return direct.slice(flag.length + 1);
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function ensureParent(filePath) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(resolveOutputPath(filePath)), { recursive: true });
}

function resolveOutputPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run(command, commandArgs, { cwd = repoRoot, allowFailure = false } = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const combined = [stdout, stderr].filter(Boolean).join('\n').trim();

  if (!allowFailure && result.status !== 0) {
    throw new Error(`Command failed (${command} ${commandArgs.join(' ')}):\n${combined}`);
  }

  return {
    status: result.status ?? 0,
    stdout,
    stderr,
    combined,
  };
}

function existingPaths(packagePath, targets) {
  return (targets ?? []).filter((target) => fs.existsSync(path.join(repoRoot, packagePath, target)));
}

function countRipgrepMatches(packagePath, targets, pattern) {
  const scopedTargets = existingPaths(packagePath, targets);
  if (scopedTargets.length === 0) return 0;

  const result = run(
    'rg',
    [
      '--no-heading',
      '--line-number',
      '--color=never',
      pattern,
      ...scopedTargets,
      '--glob', '!**/*.test.*',
      '--glob', '!**/*.spec.*',
      '--glob', '!**/__tests__/**',
      '--glob', '!**/tests/**',
      '--glob', '!**/test/**',
      '--glob', '!**/*.d.ts',
      '--glob', '!**/node_modules/**',
      '--glob', '!**/dist/**',
      '--glob', '!**/coverage/**',
      '--glob', '!**/*.md',
      '--glob', '!**/*.snap',
    ],
    { cwd: path.join(repoRoot, packagePath), allowFailure: true }
  );

  if (result.status === 1) return 0;
  if (result.status !== 0) {
    throw new Error(`ripgrep failed for ${packagePath}: ${result.combined}`);
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function walkFiles(dirPath, entries = []) {
  if (!fs.existsSync(dirPath)) return entries;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', '.turbo', '.git'].includes(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, entries);
    } else {
      entries.push(fullPath);
    }
  }
  return entries;
}

function countTestFiles(packagePath) {
  const absolutePath = path.join(repoRoot, packagePath);
  const allFiles = walkFiles(absolutePath);
  return allFiles.filter((filePath) => {
    const relative = path.relative(absolutePath, filePath).split(path.sep).join('/');
    return /(^|\/)__tests__\//.test(relative) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(relative);
  }).length;
}

function countTypeScriptErrors(packageDefinition) {
  const packageCwd = path.join(repoRoot, packageDefinition.path);
  const tsconfig = packageDefinition.tsconfig;
  if (!tsconfig || !fs.existsSync(path.join(packageCwd, tsconfig))) return 0;

  const result = run(
    'pnpm',
    ['exec', 'tsc', '--noEmit', '--pretty', 'false', '-p', tsconfig],
    { cwd: packageCwd, allowFailure: true }
  );

  const matches = result.combined.match(/error TS\d+:/g);
  return matches ? matches.length : 0;
}

function countEslintWarnings(packageDefinition) {
  const packageCwd = path.join(repoRoot, packageDefinition.path);
  const lintTargets = existingPaths(packageDefinition.path, packageDefinition.lintTargets);
  if (lintTargets.length === 0) return 0;

  const result = run(
    'pnpm',
    ['exec', 'eslint', '--format', 'json', '--no-error-on-unmatched-pattern', ...lintTargets],
    { cwd: packageCwd, allowFailure: true }
  );

  const payload = result.stdout.trim();
  if (!payload) {
    if (result.status === 0 || result.status === 1) return 0;
    throw new Error(`ESLint did not return JSON for ${packageDefinition.label}: ${result.combined}`);
  }

  let reports;
  try {
    reports = JSON.parse(payload);
  } catch (error) {
    throw new Error(`Failed to parse ESLint JSON for ${packageDefinition.label}: ${error.message}\n${payload.slice(0, 500)}`);
  }

  return reports.reduce((total, report) => total + (report.warningCount ?? 0), 0);
}

function compareMetric(metric, current, baseline) {
  if (baseline === undefined || baseline === null) {
    return { status: 'untracked', regressed: false, delta: null };
  }

  const higherIsBetter = metric === 'testCount';
  const regressed = higherIsBetter ? current < baseline : current > baseline;
  return {
    status: regressed ? 'regressed' : 'ok',
    regressed,
    delta: current - baseline,
  };
}

function formatDelta(delta, higherIsBetter = false) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return '—';
  if (delta === 0) return '0';
  const arrow = higherIsBetter ? (delta > 0 ? '↑' : '↓') : (delta < 0 ? '↓' : '↑');
  return `${arrow}${Math.abs(delta)}`;
}

function renderMetricCell(metricName, current, baseline) {
  if (baseline === undefined || baseline === null) return `${current} (new)`;
  const delta = current - baseline;
  const deltaLabel = formatDelta(delta, metricName === 'testCount');
  return `${current} (base ${baseline}, ${deltaLabel})`;
}

function renderMarkdown(report) {
  const lines = [
    '# Package Quality Scorecard',
    '',
    `Generated from \`.quality/package-scorecard.config.json\` and \`.quality/package-scorecard-baselines.json\`.`,
    '',
    '## Summary',
    '',
    `- Packages tracked: ${report.packageCount}`,
    `- Regressions: ${report.regressions.length}`,
    `- High-priority ratchets: ${report.highPriority.join(', ') || 'None'}`,
    '',
    '## Budget table',
    '',
    '| Package | Priority | Any | TS errors | ESLint warnings | TODO/FIXME | Tests | Status |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const pkg of report.packages) {
    lines.push(
      `| ${pkg.label} | ${pkg.priority} | ${renderMetricCell('anyCount', pkg.metrics.anyCount, pkg.baseline?.anyCount)} | ${renderMetricCell('tsErrorCount', pkg.metrics.tsErrorCount, pkg.baseline?.tsErrorCount)} | ${renderMetricCell('eslintWarnings', pkg.metrics.eslintWarnings, pkg.baseline?.eslintWarnings)} | ${renderMetricCell('todoFixmeCount', pkg.metrics.todoFixmeCount, pkg.baseline?.todoFixmeCount)} | ${renderMetricCell('testCount', pkg.metrics.testCount, pkg.baseline?.testCount)} | ${pkg.regressions.length ? `❌ ${pkg.regressions.join(', ')}` : '✅ within budget'} |`
    );
  }

  lines.push('', '## Ratchet focus', '');

  for (const pkg of report.packages.filter((item) => item.priority === 'high')) {
    const nextAnyTarget = pkg.ratchet?.nextTargets?.anyCount;
    lines.push(`- **${pkg.label}**: current any count is ${pkg.metrics.anyCount}. Next target is ${nextAnyTarget ?? 'not set'}.`);
  }

  if (report.regressions.length > 0) {
    lines.push('', '## Regressions', '');
    for (const regression of report.regressions) {
      lines.push(`- **${regression.label}** regressed on ${regression.metrics.join(', ')}.`);
    }
  }

  lines.push('', '## CI artifact locations', '', '- `artifacts/package-quality/scorecard.json`', '- `artifacts/package-quality/scorecard.md`');

  return lines.join('\n') + '\n';
}

const config = readJson(configPath);
if (!config?.packages?.length) {
  throw new Error(`Missing package scorecard config: ${configPath}`);
}

const previousBaseline = readJson(baselinePath, { version: 1, packages: {} });
const packageReports = config.packages.map((pkg) => {
  const metrics = {
    anyCount: countRipgrepMatches(
      pkg.path,
      pkg.productionPaths,
      '(:\\s*any(?=\\s*[,;)}\\]]|\\s*$)|as\\s+any(?=\\s*[,;)}\\]]|\\s*$)|<any>)'
    ),
    tsErrorCount: countTypeScriptErrors(pkg),
    eslintWarnings: countEslintWarnings(pkg),
    todoFixmeCount: countRipgrepMatches(pkg.path, pkg.productionPaths, 'TODO|FIXME'),
    testCount: countTestFiles(pkg.path),
  };

  const baseline = previousBaseline.packages?.[pkg.id]?.metrics;
  const comparisons = {
    anyCount: compareMetric('anyCount', metrics.anyCount, baseline?.anyCount),
    tsErrorCount: compareMetric('tsErrorCount', metrics.tsErrorCount, baseline?.tsErrorCount),
    eslintWarnings: compareMetric('eslintWarnings', metrics.eslintWarnings, baseline?.eslintWarnings),
    todoFixmeCount: compareMetric('todoFixmeCount', metrics.todoFixmeCount, baseline?.todoFixmeCount),
    testCount: compareMetric('testCount', metrics.testCount, baseline?.testCount),
  };

  const regressions = Object.entries(comparisons)
    .filter(([, comparison]) => comparison.regressed)
    .map(([metric]) => metric);

  return {
    ...pkg,
    baseline,
    metrics,
    comparisons,
    regressions,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  packageCount: packageReports.length,
  highPriority: packageReports.filter((pkg) => pkg.priority === 'high').map((pkg) => pkg.label),
  packages: packageReports,
  regressions: packageReports
    .filter((pkg) => pkg.regressions.length > 0)
    .map((pkg) => ({ label: pkg.label, metrics: pkg.regressions })),
};

if (options.writeBaseline) {
  const baselinePayload = {
    version: 1,
    generatedAt: report.generatedAt,
    packages: Object.fromEntries(
      packageReports.map((pkg) => [
        pkg.id,
        {
          label: pkg.label,
          path: pkg.path,
          priority: pkg.priority,
          metrics: pkg.metrics,
          ratchet: pkg.ratchet ?? {},
        },
      ])
    ),
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(baselinePayload, null, 2)}\n`);
}

const markdown = renderMarkdown(report);
if (options.jsonOut) {
  ensureParent(options.jsonOut);
  fs.writeFileSync(resolveOutputPath(options.jsonOut), `${JSON.stringify(report, null, 2)}\n`);
}
if (options.markdownOut) {
  ensureParent(options.markdownOut);
  fs.writeFileSync(resolveOutputPath(options.markdownOut), markdown);
}
if (options.docsOut) {
  ensureParent(options.docsOut);
  fs.writeFileSync(resolveOutputPath(options.docsOut), markdown);
}

console.log(markdown);

if (options.verify && report.regressions.length > 0) {
  console.error('Package quality scorecard regression detected:');
  for (const regression of report.regressions) {
    console.error(`- ${regression.label}: ${regression.metrics.join(', ')}`);
  }
  process.exit(1);
}
