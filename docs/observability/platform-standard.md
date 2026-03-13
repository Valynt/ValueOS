# ValueOS Observability Platform Standard

## Selected platform stack

ValueOS standardizes on an OSS-native LGTM+Sentry stack:

- **Metrics:** Prometheus
- **Logs:** Loki (via Promtail)
- **Traces:** OpenTelemetry SDK + OTEL Collector + Tempo
- **Errors:** Sentry (frontend and backend app error signal)
- **Visualization and alert UX:** Grafana

This is the single supported production stack. New services and endpoints must integrate with these components.

## Shared telemetry taxonomy

All telemetry (metrics labels, span attributes, structured log fields, error tags) must include:

- `service`
- `env`
- `tenant_id`
- `trace_id`

Recommended additional keys:

- `endpoint`
- `workflow_stage`
- `agent`
- `operation`

## Retention policy

- **Metrics (Prometheus):** 30 days high-resolution in-cluster + long-term remote store for 13 months.
- **Logs (Loki):** 30 days hot, 180 days archive.
- **Traces (Tempo):** 14 days full-fidelity for prod, 7 days for non-prod.
- **Errors (Sentry):** 90 days issue/search retention.

## Sampling policy

- `production`: parent-based traceid ratio sampler at `0.2`.
- `staging`: parent-based traceid ratio sampler at `0.5`.
- `development`: parent-based traceid ratio sampler at `1.0`.

Policies are encoded in `config/observability-policy.json` and validated by CI.
