# ValueOS Service-Level SLO Specification

_Last updated: 2026-03-13_

## Scope

This spec defines service-level SLOs for critical user and system paths:

1. **API** (`valueos-api`) for user and integration traffic.
2. **Runtime orchestration** (`ExecutionRuntime`, `DecisionRouter`, `PolicyEngine`) for lifecycle execution.
3. **Messaging** (`MessageBus` + queue workers) for asynchronous agent execution.
4. **Memory** (semantic/vector + event freshness pipeline) for recommendation quality and grounding.

Each SLO is mapped to:

- an SLI query basis,
- Prometheus recording rules,
- Prometheus alerts,
- and a runbook target.

---

## SLO Policy Windows and Error Budget Policy

- **Compliance window**: rolling 30 days.
- **Fast burn guardrail**: 5m and 1h burn rate both > `14.4x` => critical page.
- **Slow burn guardrail**: 30m and 6h burn rate both > `6x` => warning.
- **Release gate policy**: block promotions when any production/staging burn metric is above policy threshold for the guarded SLO set.

---

## Critical Path SLOs

| Path | SLI | Target | Error Budget (30d) | Notes |
|---|---|---:|---:|---|
| API availability | non-5xx / total requests | 99.95% | 0.05% | Excludes synthetic probe traffic. |
| API latency | requests <= 300ms / total requests | 95.00% | 5.00% | Histogram-bucket based good-event SLI. |
| Runtime availability | successful runtime completions / total runtime executions | 99.90% | 0.10% | Uses `runtime_execution_total{status}` labels. |
| Runtime latency | runtime executions <= 2s / total runtime executions | 95.00% | 5.00% | Measures orchestration latency. |
| Messaging availability | successful message deliveries / total deliveries | 99.90% | 0.10% | Uses CloudEvents delivery outcome labels. |
| Messaging latency | deliveries <= 1s / total deliveries | 99.00% | 1.00% | Queue + broker latency SLI. |
| Memory availability | successful memory operations / total operations | 99.90% | 0.10% | Covers semantic/vector writes and reads. |
| Memory freshness | freshness lag <= 120s / total freshness checks | 99.00% | 1.00% | Protects recommendation staleness and trace quality. |

---

## Prometheus Rule Mapping

Canonical implementation lives in `infra/k8s/monitoring/prometheus-slo-rules.yaml`.

| SLO | Recording Rules Prefix | Alerts | Runbook |
|---|---|---|---|
| API availability | `slo:api_availability:*` | `ApiAvailabilitySLOBurnRateTooHigh`, `ApiAvailabilitySLOBurnRateWarning` | `docs/runbooks/alert-runbooks.md#api-availability` |
| API latency | `slo:api_latency:*` | `ApiLatencySLOBurnRateTooHigh`, `ApiLatencySLOBurnRateWarning` | `docs/runbooks/alert-runbooks.md#api-latency` |
| Runtime availability | `slo:runtime_availability:*` | `RuntimeAvailabilitySLOBurnRateTooHigh`, `RuntimeAvailabilitySLOBurnRateWarning` | `docs/runbooks/disaster-recovery.md#runtime-failover-triggers` |
| Runtime latency | `slo:runtime_latency:*` | `RuntimeLatencySLOBurnRateTooHigh`, `RuntimeLatencySLOBurnRateWarning` | `docs/runbooks/disaster-recovery.md#runtime-failover-triggers` |
| Messaging availability | `slo:messaging_availability:*` | `MessagingAvailabilitySLOBurnRateTooHigh`, `MessagingAvailabilitySLOBurnRateWarning` | `docs/runbooks/alert-runbooks.md#messaging-and-queue-health` |
| Messaging latency | `slo:messaging_latency:*` | `MessagingLatencySLOBurnRateTooHigh`, `MessagingLatencySLOBurnRateWarning` | `docs/runbooks/alert-runbooks.md#messaging-and-queue-health` |
| Memory availability | `slo:memory_availability:*` | `MemoryAvailabilitySLOBurnRateTooHigh`, `MemoryAvailabilitySLOBurnRateWarning` | `docs/runbooks/disaster-recovery.md#memory-and-database-failover-triggers` |
| Memory freshness | `slo:memory_freshness:*` | `MemoryFreshnessSLOBurnRateTooHigh`, `MemoryFreshnessSLOBurnRateWarning` | `docs/runbooks/disaster-recovery.md#memory-and-database-failover-triggers` |

---

## Freshness SLI Definition

Freshness is evaluated as lag between source-of-truth update and propagated derived-state availability:

- `memory_freshness_lag_seconds` tracks lag for semantic memory index availability.
- `recommendation_event_freshness_lag_seconds` tracks lag for recommendation eligibility events.

The SLI treats checks as good when lag <= `120s`.

---

## Release Gate Implementation Contract

CI/CD must enforce:

1. Pull current burn metrics from Prometheus (`5m`, `1h`, `30m`, `6h` windows).
2. Fail deployment gate if:
   - critical burn > `14.4` on both fast windows, or
   - warning burn > `6` on both slow windows.
3. Emit a machine-readable summary artifact for audit.

Implementation entrypoint: `scripts/ci/observability-slo-gate.sh`.
