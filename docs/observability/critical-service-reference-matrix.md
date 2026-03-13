# Critical Service Reference Matrix

This matrix links every critical service to its governing SLO and primary runbook. CI enforces that critical service code changes include an update to this file.

| Critical service | Tier | SLO reference | Runbook reference |
|---|---|---|---|
| Backend API (`packages/backend/`) | Tier-1 | [API availability and latency SLO](./ownership-matrix.md#slo-ownership) | [Incident response runbook](../operations/incident-response.md) |
| Agent Runtime (`packages/backend/src/runtime/`) | Tier-1 | [Workflow success rate SLO](./ownership-matrix.md#slo-ownership) | [Troubleshooting runbook](../operations/runbooks/troubleshooting-runbook.md) |
| Memory subsystem (`packages/memory/`) | Tier-1 | [Realtime delivery + MTTR SLO](./ownership-matrix.md#slo-ownership) | [Disaster recovery runbook](../runbooks/disaster-recovery.md) |
| Observability stack (`infra/observability/`) | Tier-1 | [Incident MTTR SLO](./ownership-matrix.md#slo-ownership) | [Emergency procedures runbook](../runbooks/emergency-procedures.md) |
