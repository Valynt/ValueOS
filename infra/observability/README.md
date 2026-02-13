# Observability Index (Canonical)

This README is the canonical index for ValueOS observability assets: metrics, logs, traces, dashboards, alert routing, and SLO ownership.

## Ownership and escalation map

| Config / Asset | Signal area | Primary owner | Secondary owner | Escalation runbook |
|---|---|---|---|---|
| [`prometheus/prometheus.yml`](./prometheus/prometheus.yml) | Metrics scraping and recording source of truth | Platform Observability | SRE On-Call | [`docs/operations/incident-response.md`](../../docs/operations/incident-response.md) |
| [`otel-collector-config.yaml`](./otel-collector-config.yaml) | Trace + metrics ingest and pipeline processing | Platform Observability | App Runtime Team | [`docs/runbooks/deployment-runbook.md`](../../docs/runbooks/deployment-runbook.md) |
| [`loki/loki-config.yaml`](./loki/loki-config.yaml) | Log indexing, retention, and query limits | Platform Observability | SRE On-Call | [`docs/runbooks/emergency-procedures.md`](../../docs/runbooks/emergency-procedures.md) |
| [`promtail/promtail-config.yaml`](./promtail/promtail-config.yaml) | Log shipping and enrichment | App Runtime Team | Platform Observability | [`docs/operations/incident-response.md`](../../docs/operations/incident-response.md) |
| [`tempo/tempo-config.yaml`](./tempo/tempo-config.yaml) | Trace storage and search | Platform Observability | SRE On-Call | [`docs/runbooks/disaster-recovery.md`](../../docs/runbooks/disaster-recovery.md) |
| [`tempo/tempo-config-v2.yaml`](./tempo/tempo-config-v2.yaml) | Next-gen Tempo config variant (experimental) | Platform Observability | SRE On-Call | [`docs/runbooks/disaster-recovery.md`](../../docs/runbooks/disaster-recovery.md) |
| [`grafana/datasources.yml`](./grafana/datasources.yml) | Metrics/logs/traces data source wiring | Platform Observability | App Runtime Team | [`docs/runbooks/deployment-runbook.md`](../../docs/runbooks/deployment-runbook.md) |
| [`grafana/dashboards/dashboard-provider.yml`](./grafana/dashboards/dashboard-provider.yml) | Dashboard provisioning | Platform Observability | SRE On-Call | [`docs/runbooks/deployment-runbook.md`](../../docs/runbooks/deployment-runbook.md) |
| [`grafana/dashboards/mission-control.json`](./grafana/dashboards/mission-control.json) | Cross-service operational visibility dashboard | Product Engineering | Platform Observability | [`docs/operations/incident-response.md`](../../docs/operations/incident-response.md) |
| [`grafana/dashboards/agent-performance.json`](./grafana/dashboards/agent-performance.json) | Agent runtime performance dashboard | Agent Platform Team | Platform Observability | [`docs/operations/incident-response.md`](../../docs/operations/incident-response.md) |
| [`SLOs.md`](./SLOs.md) | SLO definitions and ownership | Service Owners | SRE On-Call | [`docs/operations/incident-response.md`](../../docs/operations/incident-response.md) |

## Alert routing

1. **Service owner triage first:** Alerts are acknowledged by the primary owner listed above.
2. **Escalate to secondary owner:** If no acknowledgement within the team SLO, page the secondary owner.
3. **Escalate via incident commander path:** Follow [`docs/operations/incident-response.md`](../../docs/operations/incident-response.md) and execute the relevant runbook.
4. **Post-incident updates:** Service owner updates dashboards/SLO definitions and captures follow-up tasks.

## Telemetry contract (minimum per service)

Every production service must meet this minimum contract before merge:

| Service | Structured logs | RED metrics | Trace propagation |
|---|---|---|---|
| `valueos-backend` | JSON logs with `timestamp`, `level`, `service`, `message`, `trace_id`, `span_id` | Request rate, error rate, and duration histogram exposed at `/metrics` | W3C `traceparent` accepted and forwarded on outbound calls |
| `otel-collector` | Pipeline health and export errors logged in structured format | Exported pipeline/receiver RED metrics in Prometheus namespace | Preserves incoming trace context and forwards OTLP traces to Tempo |
| `grafana` | Access and query logs enabled with service labels | Dashboard/api RED metrics enabled and scraped by Prometheus | Trace IDs retained in logs for Tempo/Loki correlation where available |
| `loki` | Ingestion/query logs include tenant/service labels | Ingestion, query error, and query latency RED metrics exposed | `trace_id` field preserved in log payloads for cross-linking |
| `tempo` | Ingestion/search/compaction logs are structured | Span ingest rate, errors, and query latency RED metrics exported | End-to-end OTLP trace context support |
| `promtail` | Shipping pipeline logs include source and stream metadata | Ship success/error rates and ship latency metrics | Captures and forwards `trace_id`/`span_id` when present in log lines |

## Enforcement

The contract above is enforced in two places:

- **PR checklist:** `.github/pull_request_template.md` includes an observability contract checkbox for contributors.
- **CI validation:** `scripts/ci/check-observability-contract.mjs` validates this index contains required ownership mappings and telemetry contract coverage.

If you add a new observability config or onboard a new service, update this file in the same PR.
