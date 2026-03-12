# Threat Model

**Last Reviewed**: 2026-03-06  
**Document Owner**: Security Engineering (`team-security`)  
**Release Window Policy**: Must be reviewed within the last **90 days** before release approval.

## Scope

This threat model covers production ValueOS services in the pnpm monorepo, including:

- Frontend apps in `apps/` (ValyntApp, VOSAcademy, mcp-dashboard).
- Backend orchestration and APIs in `packages/backend`.
- Agent-fabric execution path (`packages/backend/src/lib/agent-fabric`).
- Data/control-plane dependencies: Supabase (Postgres + Auth + Realtime), Redis/BullMQ, and LLM providers reached through secure gateway patterns.

## Architecture DFD (Data Flow Diagram)

```mermaid
flowchart LR
  user[End User Browser]\n(Tenant-scoped session)
  fe[Frontend Apps\napps/ValyntApp, VOSAcademy, mcp-dashboard]
  api[Backend API + Orchestrator\npackages/backend]
  fabric[Agent Fabric\nBaseAgent + 6 lifecycle agents]
  mem[Memory System\nTenant-scoped semantic/episodic stores]
  db[(Supabase Postgres\nRLS + organization_id/tenant_id)]
  auth[(Supabase Auth)]
  redis[(Redis/BullMQ)]
  msg[MessageBus\nCloudEvents]
  llm[LLM Gateway\nvia secureInvoke]
  audit[(Audit Logs/Telemetry)]

  user -->|HTTPS + JWT| fe
  fe -->|API calls + bearer token| api
  api -->|token verify/session| auth
  api -->|tenant-filtered SQL| db
  api -->|queue jobs| redis
  api -->|workflow orchestration| fabric
  fabric -->|secureInvoke only| llm
  fabric -->|tenant metadata required| mem
  fabric -->|state transitions/events| msg
  msg -->|persist + status updates| db
  api -->|security + business audit| audit
  fabric -->|agent audit trails| audit
```

## Trust Boundaries

1. **Boundary A: Public client → ValueOS API**
   - Threats: token theft/replay, request tampering, privilege escalation.
   - Primary controls: TLS, JWT validation, role/permission checks, server-side tenant assertions.

2. **Boundary B: API/Agent layer → Data plane (Supabase/Postgres + Memory)**
   - Threats: cross-tenant data access, RLS bypass, unsafe service-role usage.
   - Primary controls: mandatory `organization_id`/`tenant_id` filters, RLS policy tests, strict service-role restrictions.

3. **Boundary C: API/Agents → Async infrastructure (Redis/BullMQ + MessageBus)**
   - Threats: forged events, lost tenant context, replay of stale jobs/events.
   - Primary controls: propagate `trace_id` and tenant context, validate event schemas, idempotency keys + audit logging.

4. **Boundary D: Agent execution → External LLM providers**
   - Threats: prompt injection, hallucinated outputs, sensitive-data leakage.
   - Primary controls: `secureInvoke` wrapper, schema validation (Zod), hallucination checks/escalation, PII blocking.

## Tenant-Isolation Abuse Cases and Mitigations

| Abuse case | Attack path | Impact | Required mitigations |
|---|---|---|---|
| Missing tenant filter on DB query | Developer omits `.eq("organization_id", orgId)`/tenant predicate | Cross-tenant data read/write | Enforce query patterns in code review + tests, run `pnpm run test:rls` as release gate, reject merge on failing tenant tests |
| Memory/vector query without `tenant_id` metadata | Agent queries semantic memory globally | Context contamination and data exfiltration | Require `metadata.tenant_id` in all memory APIs, add unit tests for tenant-scoped retrieval |
| service_role misuse in request path | Runtime code uses privileged key for normal user flow | RLS bypass and broad data exposure | Limit `service_role` to AuthService/provisioning/cron; fail CI on policy anti-patterns; rotate keys if misuse detected |
| Cross-tenant export/import utility | Operator script copies records across org IDs | Unauthorized data transfer between tenants | Explicitly block cross-tenant copy operations; enforce allowlisted migration scripts; add release checklist sign-off |
| Tenant context dropped in async job/event | Worker consumes job without tenant assertions | Wrong-tenant mutation or leakage | Include tenant_id + trace_id in payload contract; fail handler when missing; log and quarantine invalid jobs |

## Threat-Driven Release Controls

For every release, approvers MUST verify:

1. This threat model was reviewed within the policy window (90 days).
2. Release diff does not introduce new trust boundaries without model updates.
3. Tenant isolation tests (`pnpm run test:rls`) and launch chaos/smoke suite both pass.
4. Any exception is documented with compensating controls and explicit expiration.

## Review and Approver Record

| Release | Last reviewed date | Security approver | Engineering approver | Notes |
|---|---|---|---|---|
| `v1.0.0` | `2026-03-12` | `Security Engineering (team-security)` | `Priya Raman` | `No accepted security exceptions for this release.` |
