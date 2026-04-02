#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const TEST_FILE_PATTERN = /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/i;

const CLASSIFICATION_RULES = [
  {
    category: 'e2e',
    rule:
      "Path contains '/e2e/' or filename includes '.e2e.test.' / '.e2e.spec.'",
    matches: (repoRelativePath) =>
      repoRelativePath.includes('/e2e/') ||
      /\.e2e\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(repoRelativePath),
  },
  {
    category: 'security',
    rule:
      "Path contains '/security/' or '/rls/' or filename includes '.security.test.' / '.security.spec.'",
    matches: (repoRelativePath) =>
      repoRelativePath.includes('/security/') ||
      repoRelativePath.includes('/rls/') ||
      /\.security\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(repoRelativePath),
  },
  {
    category: 'integration',
    rule:
      "Path contains '/integration/' or '/__integration__/' or filename includes '.integration.' / '.int.'",
    matches: (repoRelativePath) =>
      repoRelativePath.includes('/integration/') ||
      repoRelativePath.includes('/__integration__/') ||
      /\.(?:integration|int)\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(repoRelativePath),
  },
  {
    category: 'api',
    rule:
      "Path contains '/api/' or '/routes/' or '/controllers/' or filename includes '.api.test.' / '.api.spec.'",
    matches: (repoRelativePath) =>
      repoRelativePath.includes('/api/') ||
      repoRelativePath.includes('/routes/') ||
      repoRelativePath.includes('/controllers/') ||
      /\.api\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(repoRelativePath),
  },
  {
    category: 'component',
    rule:
      "Path contains '/component/' or '/components/' or filename includes '.component.test.' / '.component.spec.'",
    matches: (repoRelativePath) =>
      repoRelativePath.includes('/component/') ||
      repoRelativePath.includes('/components/') ||
      /\.component\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(repoRelativePath),
  },
];

function getTrackedFiles() {
  const output = execFileSync('git', ['ls-files'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((file) => file.replace(/\\/g, '/').toLowerCase());
}

function classify(repoRelativePath) {
  for (const classifier of CLASSIFICATION_RULES) {
    if (classifier.matches(repoRelativePath)) {
      return classifier.category;
    }
  }

  return 'uncategorized';
}

function renderMarkdownTable(rows) {
  const header = '| Category | Count |';
  const divider = '|---|---:|';
  const body = rows.map((row) => `| ${row.category} | ${row.count} |`).join('\n');

  return [header, divider, body].join('\n');
}

function main() {
  const trackedFiles = getTrackedFiles();
  const testFiles = trackedFiles.filter((file) => TEST_FILE_PATTERN.test(file));

  const counts = new Map([
    ['api', 0],
    ['component', 0],
    ['e2e', 0],
    ['security', 0],
    ['integration', 0],
    ['uncategorized', 0],
  ]);

  for (const file of testFiles) {
    const category = classify(file);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const orderedRows = ['api', 'component', 'e2e', 'security', 'integration', 'uncategorized'].map(
    (category) => ({
      category,
      count: counts.get(category) ?? 0,
    }),
  );

  const report = {
    scanTimestamp: new Date().toISOString(),
    repositoryRoot: repoRoot,
    totalTestFiles: testFiles.length,
    classificationRules: CLASSIFICATION_RULES.map(({ category, rule }) => ({
      category,
      rule,
    })),
    countsByCategory: Object.fromEntries(orderedRows.map((row) => [row.category, row.count])),
  };

  const markdownTable = renderMarkdownTable(orderedRows);

  process.stdout.write('## JSON\n');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n\n`);
  process.stdout.write('## Markdown Table\n');
  process.stdout.write(`${markdownTable}\n`);
}

main();
