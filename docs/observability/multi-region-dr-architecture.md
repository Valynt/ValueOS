# Multi-Region Resilience and Disaster Recovery Architecture

_Last updated: 2026-03-13_

## Topology

## Control objectives

- Keep API and runtime control-plane available during single-region failure.
- Preserve tenant-isolated durable state with bounded loss.
- Provide deterministic failover triggers, tested rollback, and auditable outcomes.

## Deployment pattern by component

| Component | Pattern | Primary | Secondary | RTO | RPO |
|---|---|---|---|---:|---:|
| API + backend runtime | **Active-Active** | Region A | Region B | 5m | 0m |
| Queue workers | **Active-Active** | Region A | Region B | 10m | 0m |
| Redis (cache / ephemeral queue) | **Active-Passive** with warm standby | Region A | Region B | 10m | 5m |
| Postgres/Supabase | **Active-Passive** with streaming replication + WAL archive | Region A | Region B | 30m | 5m |
| Memory/vector index | **Active-Passive** with replica lag checks | Region A | Region B | 20m | 10m |

## Traffic management

- Global traffic manager routes to both regions when healthy.
- Health endpoint includes API, runtime, DB connectivity, queue publish/consume probes.
- Region is removed from rotation after consecutive health check failures over threshold.

## Failover triggers

| Trigger | Signal | Threshold | Action |
|---|---|---|---|
| API regional outage | `up{job="valueos-api",region="<r>"}` | down for 2m | Route 100% traffic to healthy region |
| Runtime saturation | `slo:runtime_latency:error_budget_burn_rate5m` | >14.4 and 1h >14.4 | Pause non-critical flows; shift regional load |
| Messaging failure | `slo:messaging_availability:error_budget_burn_rate5m` | >14.4 and 1h >14.4 | Redirect publishers/consumers to healthy region |
| DB replication lag breach | `postgres_replication_lag_seconds` | >120s for 10m | Freeze failover unless SEV-1; switch to last consistent LSN |
| Memory freshness breach | `slo:memory_freshness:error_budget_burn_rate30m` | >6 and 6h >6 | Serve stale-safe recommendations + trigger index catch-up |

## Failback / rollback

1. Stabilize failed region and pass synthetic checks for 15m.
2. Confirm replication and event-log parity.
3. Shift 10% canary traffic.
4. Validate SLO burn rates and data-integrity parity.
5. Complete traffic restoration; reopen active-active.

Rollback validation is mandatory in each DR drill and captured in the DR report artifact.

## Automation

Scheduled automation workflow: `.github/workflows/dr-validation.yml`.

The workflow runs `scripts/dr-validate.sh --simulate-failover --validate-rollback` and publishes:

- `artifacts/dr/dr-validation-report.json`
- `artifacts/dr/dr-validation-summary.md`

