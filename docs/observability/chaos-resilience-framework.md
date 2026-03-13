# Chaos Resilience Framework

Defines required chaos experiment design, observability assertions, and automated reporting for production-readiness.

## 1) Failure mode catalog and expected telemetry signatures

Every chaos run MUST tag telemetry with:

- `chaos_experiment_id`
- `failure_mode`
- `trace_id`
- `organization_id`

| Failure mode          | Injection examples                                               | Trace signature                                                                                  | Log signature                                                                         | Metric signature                                                                                            | Alert expectations                                                            |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Dependency outage     | Force downstream 5xx or timeout from Supabase/Redis/LLM provider | Upstream span status `ERROR`; child span timeout/error; retry spans visible with same `trace_id` | Structured error log with dependency name, status code, retry attempt, and `trace_id` | `dependency_requests_total{outcome="error"}` spike; `dependency_timeout_total` > baseline; saturation rises | Paging alert within SLO detection window, links to dependency runbook         |
| High latency          | Add 300-1000ms latency to dependency/network path                | P95/P99 span duration regression; increased async gap spans                                      | Warning logs with latency bucket + request path + `trace_id`                          | `http_server_duration_ms` / queue processing duration histograms shift right; burn-rate warning             | Multi-window latency SLO alert triggers with low false positives              |
| Queue backlog         | Slow consumer, pause worker, increase enqueue rate               | Parent trace continues; async child traces delayed; queue wait span grows                        | Worker logs show lag/age, requeue behavior, consumer health                           | `queue_depth` and `oldest_job_age_seconds` grow continuously; throughput drops                              | Backlog alert triggers before user-visible SLA breach, links to queue runbook |
| Partial region outage | Blackhole one region/availability zone and force failover        | Traces show regional endpoint failures and fallback spans to healthy region                      | Region-tagged errors increase; failover decision logs present                         | Regional error-rate metric spikes in one region while global traffic persists                               | Regional-degradation alert fires without global-outage alert storm            |
| Message loss          | Drop or corrupt subset of bus events                             | Missing downstream spans for expected event path; gap in causal chain with same root `trace_id`  | Idempotency/replay logs increase; dead-letter entries include reason                  | `message_delivery_success_rate` drops; dead-letter and replay counters rise                                 | Message-loss alert fires and links replay/remediation runbook                 |

## 2) Required assertions for each chaos experiment

Each experiment is invalid unless all four observability planes are asserted.

### Traces (required)

- Verify root and child spans preserve `trace_id` across sync and async boundaries.
- Verify failed operations have explicit status/error attributes.
- Verify fallback/retry spans are present for resilience paths.

### Logs (required)

- Verify structured logs contain `trace_id`, `chaos_experiment_id`, and resource identifiers.
- Verify severity is correct (`warn` for degradation, `error` for failed recovery).
- Verify no PII appears in failure payloads.

### Metrics (required)

- Verify expected counter/histogram movement for injected failure mode.
- Verify tenant-safe labels (`organization_id` only; no `user_id`/email/session labels).
- Verify recovery metrics return within defined recovery objective (RTO).

### Alerts (required)

- **Detection latency**: alert fired within target minutes from injection start.
- **Precision**: no unrelated alert noise outside scoped subsystem.
- **Runbook linkage**: every fired alert annotation includes an actionable runbook URL.

## 3) Automated post-experiment report requirements

Each run MUST publish a machine-readable JSON report and a human-readable Markdown summary.

### Required report sections

1. Experiment metadata: scenario, blast radius, start/end timestamps, owner.
2. Detection performance: detection latency and precision per alert.
3. Telemetry evidence: trace IDs, log queries, metric snapshots, fired alerts.
4. Timeline reconstruction: ordered event timeline correlated by `trace_id`.
5. Recovery + residual risk: MTTR, unresolved issues, follow-up tickets.

### Timeline reconstruction contract

- Build timeline from traces first, then enrich with logs/metrics using `trace_id`.
- Include at minimum: injection start, first symptom, first alert, mitigation action, recovery complete.
- Mark any missing `trace_id` propagation as a **report failure**.

## 4) Synthetic monitoring expansion and alert fidelity validation

Synthetic monitors MUST continuously cover these user journeys:

1. User authentication + tenant context load.
2. Opportunity generation flow.
3. Value model calculation flow.
4. Narrative generation and retrieval.
5. Realization plan publish flow.

For each journey, run baseline probes and partial-failure probes (dependency slowdown, queue lag, one-region impairment). Validate:

- User-visible SLI degradation is detected.
- Alerts fire with correct severity.
- Alerts recover automatically when failure injection ends.
- No duplicate paging incidents for the same failure episode.

## 5) Production promotion gate

Production promotion is blocked unless the latest resilience scorecard in `docs/observability/resilience-scorecard.md` is marked **PASS** and references the most recent chaos report artifact.
