import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const files = {
  config: path.join(repoRoot, 'packages/backend/src/config/slo.ts'),
  prometheusRules: path.join(repoRoot, 'infra/k8s/monitoring/prometheus-slo-rules.yaml'),
  alertRules: path.join(repoRoot, 'infra/prometheus/alerts/slo-alerts.yml'),
  slosDoc: path.join(repoRoot, 'infra/observability/SLOs.md'),
  missionControl: path.join(repoRoot, 'infra/observability/grafana/dashboards/mission-control.json'),
};

function loadCanonicalThresholds() {
  const source = readFileSync(files.config, 'utf8');
  const match = source.match(/export const CANONICAL_SLO_THRESHOLDS: SLOThresholdSet = \{([\s\S]*?)\};/);

  if (!match) {
    throw new Error('Unable to locate CANONICAL_SLO_THRESHOLDS in config/slo.ts');
  }

  const literal = `{${match[1]}}`;
  return Function(`"use strict"; return (${literal});`)();
}

const t = loadCanonicalThresholds();

function renderPrometheusRules() { /* same */
return `apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-slo-rules
  namespace: monitoring
data:
  slo-rules.yaml: |
    groups:
      - name: valueos_slo_recording
        interval: 30s
        rules:
          # SLO targets
          - record: slo:target:api_availability
            expr: vector(${t.availabilityTarget})

          - record: slo:target:api_latency_p95
            expr: vector(${t.latencyP95Target})

          - record: slo:target:auth_success
            expr: vector(${t.authSuccessTarget})

          - record: slo:target:queue_health
            expr: vector(${t.queueHealthTarget})


          - record: slo:target:agent_cold_start
            expr: vector(${t.agentColdStartTarget})

          # Agent cold-start SLI (enqueue-to-ready <= ${t.agentColdStartSecondsMax}s)
          - record: slo:agent_cold_start:good_rate5m
            expr: |
              sum(rate(agent_enqueue_to_ready_seconds_bucket{le="${t.agentColdStartSecondsMax}"}[5m]))
              /
              sum(rate(agent_enqueue_to_ready_seconds_count[5m]))

          - record: slo:agent_cold_start:good_rate1h
            expr: |
              sum(rate(agent_enqueue_to_ready_seconds_bucket{le="${t.agentColdStartSecondsMax}"}[1h]))
              /
              sum(rate(agent_enqueue_to_ready_seconds_count[1h]))

          - record: slo:agent_cold_start:error_budget_burn_rate5m
            expr: |
              (1 - slo:agent_cold_start:good_rate5m) / (1 - slo:target:agent_cold_start)

          - record: slo:agent_cold_start:error_budget_burn_rate1h
            expr: |
              (1 - slo:agent_cold_start:good_rate1h) / (1 - slo:target:agent_cold_start)

          # API availability SLI (non-5xx over total)
          - record: slo:api_availability:ratio_rate5m
            expr: |
              sum(rate(http_requests_total{job="valueos-api",code!~"5.."}[5m]))
              /
              sum(rate(http_requests_total{job="valueos-api"}[5m]))

          - record: slo:api_availability:ratio_rate1h
            expr: |
              sum(rate(http_requests_total{job="valueos-api",code!~"5.."}[1h]))
              /
              sum(rate(http_requests_total{job="valueos-api"}[1h]))

          - record: slo:api_availability:error_budget_burn_rate5m
            expr: |
              (1 - slo:api_availability:ratio_rate5m) / (1 - slo:target:api_availability)

          - record: slo:api_availability:error_budget_burn_rate1h
            expr: |
              (1 - slo:api_availability:ratio_rate1h) / (1 - slo:target:api_availability)

          # API latency SLI (P95 under ${(t.latencyP95Ms / 1000).toFixed(1)}s)
          - record: slo:api_latency:good_rate5m
            expr: |
              sum(rate(http_server_request_duration_seconds_bucket{job="valueos-api",le="${(t.latencyP95Ms / 1000).toFixed(1)}"}[5m]))
              /
              sum(rate(http_server_request_duration_seconds_count{job="valueos-api"}[5m]))

          - record: slo:api_latency:good_rate1h
            expr: |
              sum(rate(http_server_request_duration_seconds_bucket{job="valueos-api",le="${(t.latencyP95Ms / 1000).toFixed(1)}"}[1h]))
              /
              sum(rate(http_server_request_duration_seconds_count{job="valueos-api"}[1h]))

          - record: slo:api_latency:error_budget_burn_rate5m
            expr: |
              (1 - slo:api_latency:good_rate5m) / (1 - slo:target:api_latency_p95)

          - record: slo:api_latency:error_budget_burn_rate1h
            expr: |
              (1 - slo:api_latency:good_rate1h) / (1 - slo:target:api_latency_p95)

          # Auth success SLI
          - record: slo:auth_success:ratio_rate5m
            expr: |
              sum(rate(auth_attempts_total{job="valueos-api",result="success"}[5m]))
              /
              sum(rate(auth_attempts_total{job="valueos-api"}[5m]))

          - record: slo:auth_success:ratio_rate1h
            expr: |
              sum(rate(auth_attempts_total{job="valueos-api",result="success"}[1h]))
              /
              sum(rate(auth_attempts_total{job="valueos-api"}[1h]))

          - record: slo:auth_success:error_budget_burn_rate5m
            expr: |
              (1 - slo:auth_success:ratio_rate5m) / (1 - slo:target:auth_success)

          - record: slo:auth_success:error_budget_burn_rate1h
            expr: |
              (1 - slo:auth_success:ratio_rate1h) / (1 - slo:target:auth_success)

          # Queue health SLI (queue depth and age within thresholds)
          - record: slo:queue_health:ratio_rate5m
            expr: |
              avg_over_time((queue_depth{job="valueos-worker",queue="default"} < bool ${t.queueDepthMax})[5m:])
              *
              avg_over_time((queue_oldest_message_age_seconds{job="valueos-worker",queue="default"} < bool ${t.queueOldestAgeSecondsMax})[5m:])

          - record: slo:queue_health:ratio_rate1h
            expr: |
              avg_over_time((queue_depth{job="valueos-worker",queue="default"} < bool ${t.queueDepthMax})[1h:])
              *
              avg_over_time((queue_oldest_message_age_seconds{job="valueos-worker",queue="default"} < bool ${t.queueOldestAgeSecondsMax})[1h:])

          - record: slo:queue_health:error_budget_burn_rate5m
            expr: |
              (1 - slo:queue_health:ratio_rate5m) / (1 - slo:target:queue_health)

          - record: slo:queue_health:error_budget_burn_rate1h
            expr: |
              (1 - slo:queue_health:ratio_rate1h) / (1 - slo:target:queue_health)

      - name: valueos_slo_burn_rate_alerts
        interval: 30s
        rules:
          - alert: ApiAvailabilitySLOBurnRateTooHigh
            expr: |
              slo:api_availability:error_budget_burn_rate5m > ${t.burnRateCritical}
              and
              slo:api_availability:error_budget_burn_rate1h > ${t.burnRateCritical}
            for: 5m
            labels:
              severity: critical
              slo: api-availability
            annotations:
              summary: "API availability error budget burn rate is critically high"
              description: "API availability burn-rate exceeded ${t.burnRateCritical}x in 5m and 1h windows"

          - alert: ApiLatencySLOBurnRateTooHigh
            expr: |
              slo:api_latency:error_budget_burn_rate5m > ${t.burnRateCritical}
              and
              slo:api_latency:error_budget_burn_rate1h > ${t.burnRateCritical}
            for: 5m
            labels:
              severity: critical
              slo: api-latency
            annotations:
              summary: "API latency error budget burn rate is critically high"
              description: "API latency burn-rate exceeded ${t.burnRateCritical}x in 5m and 1h windows"

          - alert: AuthSuccessSLOBurnRateTooHigh
            expr: |
              slo:auth_success:error_budget_burn_rate5m > ${t.burnRateCritical}
              and
              slo:auth_success:error_budget_burn_rate1h > ${t.burnRateCritical}
            for: 5m
            labels:
              severity: critical
              slo: auth-success
            annotations:
              summary: "Auth success error budget burn rate is critically high"
              description: "Auth success burn-rate exceeded ${t.burnRateCritical}x in 5m and 1h windows"

          - alert: QueueHealthSLOBurnRateTooHigh
            expr: |
              slo:queue_health:error_budget_burn_rate5m > ${t.burnRateCritical}
              and
              slo:queue_health:error_budget_burn_rate1h > ${t.burnRateCritical}
            for: 5m
            labels:
              severity: critical
              slo: queue-health
            annotations:
              summary: "Queue health error budget burn rate is critically high"
              description: "Queue health burn-rate exceeded ${t.burnRateCritical}x in 5m and 1h windows"


          - alert: AgentColdStartSLOBurnRateTooHigh
            expr: |
              slo:agent_cold_start:error_budget_burn_rate5m > ${t.burnRateCritical}
              and
              slo:agent_cold_start:error_budget_burn_rate1h > ${t.burnRateCritical}
            for: 5m
            labels:
              severity: critical
              slo: agent-cold-start
            annotations:
              summary: "Agent cold-start enqueue-to-ready SLO burn rate is critically high"
              description: "Cold-start burn-rate exceeded ${t.burnRateCritical}x in 5m and 1h windows"
`;}

function renderAlertRules(){return `groups:
  - name: api-slo-availability
    rules:
      # Global API availability SLO: 99.9% success rate (error budget 0.1%)
      - alert: APIAvailabilityFastBurn
        expr: |
          sum(rate(valuecanvas_http_requests_total{status_code=~"5.."}[5m]))
          /
          sum(rate(valuecanvas_http_requests_total[5m]))
          > ${t.errorRateFastBurnMax}
        for: 10m
        labels:
          severity: critical
          slo: availability
        annotations:
          summary: "Fast burn: API availability SLO breach"
          description: "5xx error ratio is above ${(t.errorRateFastBurnMax * 100).toFixed(2)}% for 10m, consuming error budget too quickly."

      - alert: APIAvailabilitySlowBurn
        expr: |
          sum(rate(valuecanvas_http_requests_total{status_code=~"5.."}[30m]))
          /
          sum(rate(valuecanvas_http_requests_total[30m]))
          > ${t.errorRateSlowBurnMax}
        for: 1h
        labels:
          severity: warning
          slo: availability
        annotations:
          summary: "Slow burn: API availability SLO at risk"
          description: "5xx error ratio is above ${(t.errorRateSlowBurnMax * 100).toFixed(2)}% for 1h (below ${(t.availabilityTarget * 100).toFixed(1)}% availability objective)."

  - name: api-slo-latency
    rules:
      # API latency SLO: p95 under ${t.latencyP95Ms}ms
      - alert: APILatencyP95High
        expr: |
          histogram_quantile(
            0.95,
            sum(rate(valuecanvas_http_request_duration_ms_bucket[5m])) by (le)
          ) > ${t.latencyP95Ms}
        for: 10m
        labels:
          severity: warning
          slo: latency
        annotations:
          summary: "High p95 latency"
          description: "P95 API latency has exceeded ${t.latencyP95Ms}ms for at least 10m."

  - name: api-slo-mttr
    rules:
      # MTTR SLO: incidents should resolve in <= ${t.mttrMinutesMax} minutes
      - alert: APIMTTRHigh
        expr: |
          avg_over_time(valuecanvas_incident_mttr_minutes[24h]) > ${t.mttrMinutesMax}
        for: 15m
        labels:
          severity: critical
          slo: mttr
        annotations:
          summary: "MTTR SLO breach"
          description: "Average incident MTTR over 24h exceeds ${t.mttrMinutesMax} minutes."
`;}

function renderSlosDoc(){return `# Service Level Objectives (SLOs)

This document formalizes ValueOS reliability SLOs backed by **OpenTelemetry instrumentation** and **Prometheus evaluation**.

## Scope

The SLO gate currently evaluates the backend HTTP surface (\`service="valueos-backend"\`) and incident lifecycle metrics exported by the OpenTelemetry SDK/collector.

## SLO Targets

| SLI | Target | Measurement window | PromQL source |
| --- | --- | --- | --- |
| Latency (P95) | \`<= ${t.latencyP95Ms}ms\` | 5m rolling | \`histogram_quantile(0.95, sum(rate(valuecanvas_http_request_duration_ms_bucket[5m])) by (le))\` |
| Error rate | \`<= ${(t.errorRateSlowBurnMax * 100).toFixed(1)}%\` (${(t.availabilityTarget * 100).toFixed(1)}% success) | 5m rolling | \`sum(rate(valuecanvas_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(valuecanvas_http_requests_total[5m]))\` |
| MTTR | \`<= ${t.mttrMinutesMax} minutes\` | 24h rolling | \`avg_over_time(valuecanvas_incident_mttr_minutes[24h])\` |

## OpenTelemetry Requirements

To keep SLO math consistent across services, instrument with OTEL semantic conventions:

- HTTP request duration histogram (\`valuecanvas_http_request_duration_ms_bucket\`).
- HTTP request counter with status labels (\`valuecanvas_http_requests_total{status_code=...}\`).
- Incident duration/MTTR gauge (\`valuecanvas_incident_mttr_minutes\`) updated at incident close.

## Pipeline Quality Gate

CI calls \`scripts/ci/observability-slo-gate.sh\`.

- It executes PromQL queries against \`PROMETHEUS_BASE_URL\`.
- The job **fails** when any target is breached.
- This provides a hard gate to block merges that degrade reliability/performance.

Default thresholds (override with env vars):

- \`SLO_MAX_P95_LATENCY_MS=${t.latencyP95Ms}\`
- \`SLO_MAX_ERROR_RATE=${t.errorRateSlowBurnMax}\`
- \`SLO_MAX_MTTR_MINUTES=${t.mttrMinutesMax}\`
`;}

function renderMissionControl() {
  const dashboard = JSON.parse(readFileSync(files.missionControl, 'utf8'));
  const warningLatency = Math.round(t.latencyP95Ms * 0.75);

  for (const panel of dashboard.panels ?? []) {
    if (panel.id === 1) {
      panel.title = `P95 Latency (target: ${t.latencyP95Ms}ms)`;
      panel.fieldConfig.defaults.thresholds.steps = [
        { color: 'green', value: null },
        { color: 'yellow', value: warningLatency },
        { color: 'red', value: t.latencyP95Ms },
      ];
    }

    if (panel.id === 2) {
      panel.title = `Error Rate (target: < ${(t.errorRateSlowBurnMax * 100).toFixed(1)}%)`;
    }

    if (panel.id === 3) {
      panel.title = `MTTR (target: < ${t.mttrMinutesMax}min)`;
    }
  }

  return `${JSON.stringify(dashboard, null, 2)}
`;
}

const expectedOutputs = [
  { path: files.prometheusRules, content: renderPrometheusRules() },
  { path: files.alertRules, content: renderAlertRules() },
  { path: files.slosDoc, content: renderSlosDoc() },
  { path: files.missionControl, content: renderMissionControl() },
];

const shouldWrite = process.argv.includes('--write');
let hasDiff = false;

for (const output of expectedOutputs) {
  const current = readFileSync(output.path, 'utf8');
  if (current !== output.content) {
    hasDiff = true;
    if (shouldWrite) {
      writeFileSync(output.path, output.content);
      console.log(`✍️ Updated ${path.relative(repoRoot, output.path)}`);
    } else {
      console.error(`❌ Drift detected in ${path.relative(repoRoot, output.path)}`);
    }
  }
}

if (hasDiff && !shouldWrite) {
  console.error('Run: node scripts/ci/check-slo-threshold-consistency.mjs --write');
  process.exit(1);
}

console.log(hasDiff ? '✅ SLO assets synchronized.' : '✅ SLO consistency check passed.');
