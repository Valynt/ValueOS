import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const files = {
  config: path.join(repoRoot, 'packages/backend/src/config/slo.ts'),
  loadTest: path.join(repoRoot, 'infra/testing/load-test.k6.js'),
  productionContract: path.join(repoRoot, 'docs/security-compliance/production-contract.md'),
  runbook: path.join(repoRoot, 'docs/runbooks/alert-runbooks.md'),
  hpa: path.join(repoRoot, 'infra/k8s/base/hpa.yaml'),
  adapterRules: path.join(repoRoot, 'infra/k8s/base/prometheus-adapter-rules.yaml'),
  observabilityAlerts: path.join(repoRoot, 'infra/observability/prometheus/alerts/api-latency-slos.yml'),
  sloAlerts: path.join(repoRoot, 'infra/prometheus/alerts/slo-alerts.yml'),
  backendAlerts: path.join(repoRoot, 'infra/prometheus/alerts/backend-api-alerts.yml'),
  sloDoc: path.join(repoRoot, 'infra/observability/SLOs.md'),
  missionControl: path.join(repoRoot, 'infra/observability/grafana/dashboards/mission-control.json'),
};

function read(relativePath) {
  return readFileSync(relativePath, 'utf8');
}

function extractNumber(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Unable to find ${label}`);
  }
  return Number(match[1]);
}

const configSource = read(files.config);
const expected = {
  interactiveMs: extractNumber(configSource, /interactiveLatencyP95Ms:\s*(\d+)/, 'interactiveLatencyP95Ms'),
  orchestrationTtfbMs: extractNumber(configSource, /orchestrationTtfbP95Ms:\s*(\d+)/, 'orchestrationTtfbP95Ms'),
  orchestrationCompletionMs: extractNumber(
    configSource,
    /orchestrationCompletionP95Ms:\s*(\d+)/,
    'orchestrationCompletionP95Ms',
  ),
};

const checks = [];
function ok(description) {
  checks.push({ ok: true, description });
}
function fail(description) {
  checks.push({ ok: false, description });
}
function expectRegex(source, pattern, description) {
  if (pattern.test(source)) {
    ok(description);
  } else {
    fail(description);
  }
}

const loadTestSource = read(files.loadTest);
expectRegex(
  loadTestSource,
  new RegExp(`interactive_completion_latency[\\s\\S]*threshold:\\s*"p\\(95\\)<${expected.interactiveMs}"`),
  `load test interactive completion threshold matches ${expected.interactiveMs}ms`,
);
expectRegex(
  loadTestSource,
  new RegExp(`orchestration_ttfb_latency:\\s*\\["p\\(95\\)<${expected.orchestrationTtfbMs}"\\]`),
  `load test orchestration TTFB threshold matches ${expected.orchestrationTtfbMs}ms`,
);
expectRegex(
  loadTestSource,
  new RegExp(`ORCHESTRATION_COMPLETION_SLO_MS = ${expected.orchestrationCompletionMs}`),
  `load test orchestration completion threshold matches ${expected.orchestrationCompletionMs}ms`,
);

const productionContract = read(files.productionContract);
expectRegex(
  productionContract,
  new RegExp(`Interactive completion latency P95 \| ≤ ${expected.interactiveMs}ms`),
  `production contract interactive threshold matches ${expected.interactiveMs}ms`,
);
expectRegex(
  productionContract,
  new RegExp(`Orchestration TTFB P95 \| ≤ ${expected.orchestrationTtfbMs}ms`),
  `production contract orchestration TTFB threshold matches ${expected.orchestrationTtfbMs}ms`,
);
expectRegex(
  productionContract,
  new RegExp(`Orchestration completion latency P95 \| ≤ ${expected.orchestrationCompletionMs}ms`),
  `production contract orchestration completion threshold matches ${expected.orchestrationCompletionMs}ms`,
);

const runbookSource = read(files.runbook);
expectRegex(
  runbookSource,
  new RegExp(`interactive request completion p95 exceeds \\*\\*${expected.interactiveMs}ms\\*\\*`),
  `runbook interactive threshold matches ${expected.interactiveMs}ms`,
);
expectRegex(
  runbookSource,
  new RegExp(`TTFB p95 exceeds .*${expected.orchestrationTtfbMs}ms`),
  `runbook orchestration TTFB threshold matches ${expected.orchestrationTtfbMs}ms`,
);
expectRegex(
  runbookSource,
  new RegExp(`completion p95 exceeds \\*\\*${expected.orchestrationCompletionMs}ms\\*\\*`),
  `runbook orchestration completion threshold matches ${expected.orchestrationCompletionMs}ms`,
);

const hpaSource = read(files.hpa);
expectRegex(
  hpaSource,
  new RegExp(`name: backend_interactive_http_p95_latency_ms[\\s\\S]*value: "${expected.interactiveMs}"`),
  `HPA interactive external metric target matches ${expected.interactiveMs}ms`,
);
expectRegex(
  hpaSource,
  new RegExp(`name: backend_orchestration_ttfb_p95_latency_ms[\\s\\S]*value: "${expected.orchestrationTtfbMs}"`),
  `HPA orchestration TTFB external metric target matches ${expected.orchestrationTtfbMs}ms`,
);

const adapterSource = read(files.adapterRules);
expectRegex(
  adapterSource,
  /as: "backend_interactive_http_p95_latency_ms"/,
  'adapter exposes backend_interactive_http_p95_latency_ms',
);
expectRegex(
  adapterSource,
  /as: "backend_orchestration_ttfb_p95_latency_ms"/,
  'adapter exposes backend_orchestration_ttfb_p95_latency_ms',
);
expectRegex(
  adapterSource,
  /as: "backend_orchestration_completion_p95_latency_ms"/,
  'adapter exposes backend_orchestration_completion_p95_latency_ms',
);
expectRegex(
  adapterSource,
  /valuecanvas_http_request_ttfb_ms_bucket/,
  'adapter uses the TTFB histogram metric for orchestration TTFB',
);

for (const [fileKey, filePath] of Object.entries({
  observabilityAlerts: files.observabilityAlerts,
  sloAlerts: files.sloAlerts,
  backendAlerts: files.backendAlerts,
})) {
  const source = read(filePath);
  expectRegex(
    source,
    new RegExp(`> ${expected.interactiveMs}`),
    `${fileKey} contains the ${expected.interactiveMs}ms interactive threshold`,
  );
  expectRegex(
    source,
    new RegExp(`> ${expected.orchestrationTtfbMs}`),
    `${fileKey} contains the ${expected.orchestrationTtfbMs}ms orchestration TTFB threshold`,
  );
  expectRegex(
    source,
    new RegExp(`> ${expected.orchestrationCompletionMs}`),
    `${fileKey} contains the ${expected.orchestrationCompletionMs}ms orchestration completion threshold`,
  );
}

const sloDocSource = read(files.sloDoc);
expectRegex(
  sloDocSource,
  new RegExp(`Interactive completion latency \| .*<= ${expected.interactiveMs}ms`),
  `observability SLO doc interactive threshold matches ${expected.interactiveMs}ms`,
);
expectRegex(
  sloDocSource,
  new RegExp(`Orchestration TTFB \| .*<= ${expected.orchestrationTtfbMs}ms`),
  `observability SLO doc orchestration TTFB threshold matches ${expected.orchestrationTtfbMs}ms`,
);
expectRegex(
  sloDocSource,
  new RegExp(`Orchestration completion latency \| .*<= ${expected.orchestrationCompletionMs}ms`),
  `observability SLO doc orchestration completion threshold matches ${expected.orchestrationCompletionMs}ms`,
);

const dashboard = JSON.parse(read(files.missionControl));
const panelTitles = new Set();
const titleToThresholds = new Map();
for (const panel of dashboard.panels ?? []) {
  if (panel.title) {
    panelTitles.add(panel.title);
    const steps = panel.fieldConfig?.defaults?.thresholds?.steps;
    if (steps) {
      titleToThresholds.set(
        panel.title,
        steps
          .map((step) => step.value)
          .filter((value) => value !== null && value !== undefined),
      );
    }
  }
}

function expectPanel(title, expectedThreshold) {
  if (!panelTitles.has(title)) {
    fail(`dashboard contains panel "${title}"`);
    return;
  }
  ok(`dashboard contains panel "${title}"`);
  const thresholds = titleToThresholds.get(title) ?? [];
  if (thresholds.includes(expectedThreshold)) {
    ok(`dashboard panel "${title}" threshold matches ${expectedThreshold}ms`);
  } else {
    fail(`dashboard panel "${title}" threshold matches ${expectedThreshold}ms`);
  }
}

expectPanel(`Interactive Completion P95 (target: ${expected.interactiveMs}ms)`, expected.interactiveMs);
expectPanel(`Orchestration TTFB P95 (target: ${expected.orchestrationTtfbMs}ms)`, expected.orchestrationTtfbMs);
expectPanel(
  `Orchestration Completion P95 (target: ${expected.orchestrationCompletionMs}ms)`,
  expected.orchestrationCompletionMs,
);

const failed = checks.filter((entry) => !entry.ok);
for (const entry of checks) {
  const symbol = entry.ok ? '✅' : '❌';
  console.log(`${symbol} ${entry.description}`);
}

if (failed.length > 0) {
  console.error(`\nSLO threshold consistency check failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log('\nAll split-latency SLO thresholds are synchronized.');
