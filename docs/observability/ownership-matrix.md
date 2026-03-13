# Observability Ownership Matrix

This matrix defines explicit ownership for SLOs, dashboards, and runbooks, including backup owners for continuity during incidents and PTO.

## SLO ownership

| SLO | Primary team | Primary owner | Backup owner | Measurement source |
|---|---|---|---|---|
| API availability (99.9%) | Platform Engineering | Backend Lead (platform-oncall@valueos.com) | SRE Manager (sre-backup@valueos.com) | Prometheus `up`, API synthetic checks |
| API latency p95 (< 200 ms) | Platform Engineering | Runtime Lead | Data Platform Lead | Prometheus latency histograms |
| Workflow success rate (>= 99.5%) | Agent Platform | Agent Fabric Lead | Backend Lead | ExecutionRuntime completion metrics |
| Realtime event delivery (>= 99.0%) | Infrastructure | Realtime Lead | Platform Engineering Manager | RealtimeBroadcastService delivery metrics |
| Incident MTTR (< 15 min for Sev1/Sev2) | SRE | Incident Commander on-call | Operations Manager | Incident response tracker + Prometheus |

## Dashboard ownership

| Dashboard | Primary team | Primary owner | Backup owner |
|---|---|---|---|
| Mission Control (`infra/observability/grafana/dashboards/mission-control.json`) | SRE | SRE Dashboard Owner | Platform Engineering Manager |
| Agent Performance (`infra/observability/grafana/dashboards/agent-performance.json`) | Agent Platform | Agent Observability Owner | Runtime Lead |
| Query Fingerprint Performance | Data Platform | Database Reliability Owner | SRE Dashboard Owner |
| On-call Drill Trends (`.github/metrics/oncall-drill-trends.json`) | SRE | On-call Program Owner | Operations Manager |

## Runbook ownership

| Runbook | Primary team | Primary owner | Backup owner |
|---|---|---|---|
| `docs/runbooks/deployment-runbook.md` | Release Engineering | Release Manager | Platform Engineering Manager |
| `docs/runbooks/disaster-recovery.md` | SRE | DR Lead | Infra Lead |
| `docs/runbooks/emergency-procedures.md` | Security + SRE | Security Operations Lead | Incident Commander Rotation |
| `docs/operations/runbooks/troubleshooting-runbook.md` | Operations | Operations Lead | Support Engineering Lead |
| `docs/operations/incident-response.md` | SRE | Incident Response Lead | SRE Manager |

## Escalation expectations

- Each primary owner is accountable for SLO/rule tuning, runbook freshness, and quarterly evidence review.
- Backup owners must be trained to execute the same runbooks and lead incident response when primary owners are unavailable.
- Ownership changes must be reflected in this file within one business day.
