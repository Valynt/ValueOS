#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const readmeFile = 'infra/observability/README.md';
const readmePath = path.resolve(repoRoot, readmeFile);

const requiredConfigLinks = [
  './prometheus/prometheus.yml',
  './otel-collector-config.yaml',
  './loki/loki-config.yaml',
  './tempo/tempo-config.yaml',
  './tempo/tempo-config-v2.yaml',
  './promtail/promtail-config.yaml',
  './grafana/datasources.yml',
  './grafana/dashboards/dashboard-provider.yml',
  './grafana/dashboards/mission-control.json',
  './grafana/dashboards/agent-performance.json',
];

const requiredRunbooks = [
  '../../docs/operations/incident-response.md',
  '../../docs/runbooks/deployment-runbook.md',
  '../../docs/runbooks/disaster-recovery.md',
  '../../docs/runbooks/emergency-procedures.md',
];

const requiredServices = [
  'valueos-backend',
  'otel-collector',
  'grafana',
  'loki',
  'tempo',
  'promtail',
];

const requiredContractTerms = ['structured logs', 'RED metrics', 'trace propagation'];

const markdown = await readFile(readmePath, 'utf8');
const errors = [];

if (!markdown.includes('## Ownership and escalation map')) {
  errors.push('Missing section: "Ownership and escalation map".');
}

if (!markdown.includes('## Telemetry contract (minimum per service)')) {
  errors.push('Missing section: "Telemetry contract (minimum per service)".');
}

if (!markdown.includes('## Alert routing')) {
  errors.push('Missing section: "Alert routing".');
}

for (const term of requiredContractTerms) {
  if (!markdown.toLowerCase().includes(term.toLowerCase())) {
    errors.push(`Telemetry contract term missing: "${term}".`);
  }
}

for (const configLink of requiredConfigLinks) {
  if (!markdown.includes(`](${configLink})`)) {
    errors.push(`Missing config mapping link: ${configLink}`);
  }
}

for (const runbookLink of requiredRunbooks) {
  if (!markdown.includes(`](${runbookLink})`)) {
    errors.push(`Missing escalation runbook link: ${runbookLink}`);
  }
}

for (const service of requiredServices) {
  if (!markdown.includes(`\`${service}\``)) {
    errors.push(`Missing telemetry contract entry for service: ${service}`);
  }
}

if (errors.length > 0) {
  console.error(`❌ Observability contract check failed for ${readmeFile}.`);
  for (const error of errors) {
    console.error(` - ${error}`);
  }
  process.exit(1);
}

console.log(`✅ Observability contract check passed for ${readmeFile}.`);
console.log(`Validated ${requiredConfigLinks.length} config link(s), ${requiredServices.length} service contract row(s), and ${requiredRunbooks.length} runbook link(s).`);
