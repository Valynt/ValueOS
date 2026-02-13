import fs from 'node:fs';
import path from 'node:path';

const reportPath = path.resolve('playwright-report/a11y-results.json');
const outputDir = path.resolve('playwright-report');
const trendPath = path.join(outputDir, 'a11y-trend.json');
const markdownPath = path.join(outputDir, 'a11y-summary.md');

if (!fs.existsSync(reportPath)) {
  console.error(`Missing Playwright JSON report: ${reportPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const specs = [];
const walkSuites = (suite, titlePath = []) => {
  for (const childSuite of suite.suites ?? []) {
    walkSuites(childSuite, [...titlePath, childSuite.title].filter(Boolean));
  }

  for (const spec of suite.specs ?? []) {
    specs.push({
      title: [...titlePath, spec.title].join(' > '),
      ok: spec.ok,
      tests: spec.tests ?? [],
    });
  }
};

for (const suite of report.suites ?? []) {
  walkSuites(suite, [suite.title].filter(Boolean));
}

const totals = {
  specs: specs.length,
  passed: specs.filter((s) => s.ok).length,
  failed: specs.filter((s) => !s.ok).length,
};

const timestamp = new Date().toISOString();
const trend = {
  timestamp,
  totals,
  specs: specs.map((spec) => ({ title: spec.title, ok: spec.ok })),
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(trendPath, JSON.stringify(trend, null, 2));

const markdown = [
  '# Accessibility Regression Snapshot',
  '',
  `- Generated: ${timestamp}`,
  `- Total specs: ${totals.specs}`,
  `- Passed: ${totals.passed}`,
  `- Failed: ${totals.failed}`,
  '',
  '## Spec status',
  ...specs.map((s) => `- ${s.ok ? '✅' : '❌'} ${s.title}`),
  '',
  '> Trend tracking: keep this artifact per CI run to compare pass/fail drift over time.',
  '',
].join('\n');

fs.writeFileSync(markdownPath, markdown);
console.log(`Wrote ${trendPath}`);
console.log(`Wrote ${markdownPath}`);
