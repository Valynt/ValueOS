#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();

const EXPECTED = {
  interactiveCompletionP95Ms: 200,
  orchestrationTtfbP95Ms: 200,
  orchestrationCompletionP95Ms: 3000,
};

const files = {
  backendConfig: 'packages/backend/src/config/slo.ts',
  loadTest: 'infra/testing/load-test.k6.js',
  hpa: 'infra/k8s/base/hpa.yaml',
  productionContract: 'docs/security-compliance/production-contract.md',
  runbook: 'docs/runbooks/alert-runbooks.md',
  backendAlerts: 'infra/prometheus/alerts/backend-api-alerts.yml',
  sloAlerts: 'infra/prometheus/alerts/slo-alerts.yml',
  dashboard: 'infra/observability/grafana/dashboards/mission-control.json',
  observabilitySlos: 'infra/observability/SLOs.md',
};

const contents = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, relativePath]) => [
      key,
      await readFile(path.resolve(repoRoot, relativePath), 'utf8'),
    ]),
  ),
);

const errors = [];

function expectRegex(content, regex, label) {
  if (!regex.test(content)) {
    errors.push(`Missing ${label}.`);
  }
}

function extractNumber(content, regex, label) {
  const match = content.match(regex);
  if (!match) {
    errors.push(`Could not extract ${label}.`);
    return null;
  }

  return Number(match[1]);
}

const backendInteractive = extractNumber(
  contents.backendConfig,
  /interactiveCompletionP95Ms:\s*(\d+)/,
  'interactive completion threshold from backend config',
);
const backendOrchestrationTtfb = extractNumber(
  contents.backendConfig,
  /orchestrationTtfbP95Ms:\s*(\d+)/,
  'orchestration TTFB threshold from backend config',
);
const backendOrchestrationCompletion = extractNumber(
  contents.backendConfig,
  /orchestrationCompletionP95Ms:\s*(\d+)/,
  'orchestration completion threshold from backend config',
);

for (const [label, value] of Object.entries({
  interactiveCompletionP95Ms: backendInteractive,
  orchestrationTtfbP95Ms: backendOrchestrationTtfb,
  orchestrationCompletionP95Ms: backendOrchestrationCompletion,
})) {
  if (value !== null && value !== EXPECTED[label]) {
    errors.push(`Backend config ${label} expected ${EXPECTED[label]}, found ${value}.`);
  }
}

const loadInteractive = extractNumber(
  contents.loadTest,
  /const INTERACTIVE_COMPLETION_SLO_MS = (\d+);/,
  'interactive completion threshold from load test',
);
const loadTtfb = extractNumber(
  contents.loadTest,
  /const ORCHESTRATION_TTFB_SLO_MS = (\d+);/,
  'orchestration TTFB threshold from load test',
);
const loadCompletion = extractNumber(
  contents.loadTest,
  /const ORCHESTRATION_COMPLETION_SLO_MS = (\d+);/,
  'orchestration completion threshold from load test',
);

if (loadInteractive !== EXPECTED.interactiveCompletionP95Ms) {
  errors.push(`Load test interactive completion threshold drifted to ${loadInteractive}.`);
}
if (loadTtfb !== EXPECTED.orchestrationTtfbP95Ms) {
  errors.push(`Load test orchestration TTFB threshold drifted to ${loadTtfb}.`);
}
if (loadCompletion !== EXPECTED.orchestrationCompletionP95Ms) {
  errors.push(`Load test orchestration completion threshold drifted to ${loadCompletion}.`);
}

const hpaInteractive = extractNumber(
  contents.hpa,
  /name:\s*backend_interactive_http_p95_latency_ms[\s\S]*?value:\s*"(\d+)"/,
  'interactive latency HPA target',
);
const hpaTtfb = extractNumber(
  contents.hpa,
  /name:\s*backend_orchestration_ttfb_p95_latency_ms[\s\S]*?value:\s*"(\d+)"/,
  'orchestration TTFB HPA target',
);

if (hpaInteractive !== EXPECTED.interactiveCompletionP95Ms) {
  errors.push(`HPA interactive latency target drifted to ${hpaInteractive}.`);
}
if (hpaTtfb !== EXPECTED.orchestrationTtfbP95Ms) {
  errors.push(`HPA orchestration TTFB target drifted to ${hpaTtfb}.`);
}

expectRegex(contents.productionContract, /Interactive completion latency P95 \| ≤ 200ms/, 'interactive production contract row');
expectRegex(contents.productionContract, /Orchestration TTFB P95 \| ≤ 200ms/, 'orchestration TTFB production contract row');
expectRegex(contents.productionContract, /Orchestration completion latency P95 \| ≤ 3000ms/, 'orchestration completion production contract row');

expectRegex(contents.runbook, /## HighInteractiveCompletionLatency/, 'interactive runbook section');
expectRegex(contents.runbook, /Interactive completion p95 exceeds 200ms/, 'interactive runbook threshold');
expectRegex(contents.runbook, /## HighOrchestrationTTFB/, 'orchestration TTFB runbook section');
expectRegex(contents.runbook, /Orchestration request p95 time-to-first-byte exceeds 200ms/, 'orchestration TTFB runbook threshold');
expectRegex(contents.runbook, /## HighOrchestrationCompletionLatency/, 'orchestration completion runbook section');
expectRegex(contents.runbook, /Orchestration completion p95 exceeds 3000ms/, 'orchestration completion runbook threshold');

expectRegex(contents.backendAlerts, /alert:\s*HighInteractiveCompletionLatency[\s\S]*?> 200/, 'interactive backend alert threshold');
expectRegex(contents.backendAlerts, /alert:\s*HighOrchestrationTTFB[\s\S]*?> 200/, 'orchestration TTFB backend alert threshold');
expectRegex(contents.backendAlerts, /alert:\s*HighOrchestrationCompletionLatency[\s\S]*?> 3000/, 'orchestration completion backend alert threshold');

expectRegex(contents.sloAlerts, /alert:\s*APIInteractiveCompletionP95High[\s\S]*?> 200/, 'interactive SLO alert threshold');
expectRegex(contents.sloAlerts, /alert:\s*APIOrchestrationTTFBP95High[\s\S]*?> 200/, 'orchestration TTFB SLO alert threshold');
expectRegex(contents.sloAlerts, /alert:\s*APIOrchestrationCompletionP95High[\s\S]*?> 3000/, 'orchestration completion SLO alert threshold');

expectRegex(contents.observabilitySlos, /Interactive completion latency \| `>= 95% <= 200ms`/, 'observability interactive SLO row');
expectRegex(contents.observabilitySlos, /Orchestration TTFB latency \| `p95 <= 200ms`/, 'observability orchestration TTFB row');
expectRegex(contents.observabilitySlos, /Orchestration completion latency \| `>= 95% <= 3000ms`/, 'observability orchestration completion row');

const dashboard = JSON.parse(contents.dashboard);
const panelByTitle = new Map(dashboard.panels.map((panel) => [panel.title, panel]));

const interactivePanel = panelByTitle.get('Interactive Completion P95 (target: 200ms)');
if (!interactivePanel) {
  errors.push('Dashboard missing interactive completion stat panel.');
} else if (interactivePanel.fieldConfig?.defaults?.thresholds?.steps?.[2]?.value !== EXPECTED.interactiveCompletionP95Ms) {
  errors.push(`Dashboard interactive completion stat threshold expected ${EXPECTED.interactiveCompletionP95Ms}.`);
}

const orchestrationTtfbPanel = panelByTitle.get('Orchestration TTFB P95 (target: 200ms)');
if (!orchestrationTtfbPanel) {
  errors.push('Dashboard missing orchestration TTFB panel.');
} else if (orchestrationTtfbPanel.fieldConfig?.defaults?.thresholds?.steps?.[2]?.value !== EXPECTED.orchestrationTtfbP95Ms) {
  errors.push(`Dashboard orchestration TTFB threshold expected ${EXPECTED.orchestrationTtfbP95Ms}.`);
}

const orchestrationCompletionPanel = panelByTitle.get('Orchestration Completion Percentiles');
if (!orchestrationCompletionPanel) {
  errors.push('Dashboard missing orchestration completion panel.');
} else if (orchestrationCompletionPanel.fieldConfig?.defaults?.thresholds?.steps?.[2]?.value !== EXPECTED.orchestrationCompletionP95Ms) {
  errors.push(`Dashboard orchestration completion threshold expected ${EXPECTED.orchestrationCompletionP95Ms}.`);
}

if (errors.length > 0) {
  console.error('❌ Performance SLO synchronization check failed.');
  for (const error of errors) {
    console.error(` - ${error}`);
  }
  process.exit(1);
}

console.log('✅ Performance SLO synchronization check passed.');
console.log(`Interactive completion p95: ${EXPECTED.interactiveCompletionP95Ms}ms`);
console.log(`Orchestration TTFB p95: ${EXPECTED.orchestrationTtfbP95Ms}ms`);
console.log(`Orchestration completion p95: ${EXPECTED.orchestrationCompletionP95Ms}ms`);
