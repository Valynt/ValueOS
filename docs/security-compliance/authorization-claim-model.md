---
title: Authorization Claim Model
owner: security-architect
system: valueos-platform
status: active
review_cadence: quarterly
related_controls: CC6.1, CC6.3, CC6.4
---

# Authorization Claim Model

Defines the claim schema used for authorization decisions across agent-to-agent calls, service-to-service calls, and tenant-scoped API requests. All authorization decisions in ValueOS must be traceable to a claim that satisfies this schema.

## Claim Schema

```typescript
interface AuthorizationClaim {
  /** SPIFFE ID of the calling workload, e.g. spiffe://valueos.internal/ns/valynt/agents/opportunity */
  subject: string;

  /** Organization/tenant UUID. Every claim must be scoped to a tenant. */
  tenant_id: string;

  /** Action being requested. Format: "{resource}:{verb}" */
  action: string;

  /** Target environment. Controls which policy set is evaluated. */
  environment: "production" | "staging" | "dev";

  /** Unix timestamp (ms) when the claim was issued. */
  issued_at: number;

  /** Unix timestamp (ms) when the claim expires. Max TTL: 2 minutes for service calls. */
  expires_at: number;
}
```

## Action Vocabulary

Actions follow the `{resource}:{verb}` pattern. Registered actions:

| Action | Description | Allowed subjects |
|---|---|---|
| `agent:invoke` | Invoke an agent execution | `services/backend-api`, orchestrator services |
| `agent:handoff` | Pass execution context to another agent | Agents per `agent-handoff-allowlist.md` |
| `evidence:write` | Append a compliance evidence record | `agents/compliance-auditor`, `services/backend-api` |
| `evidence:read` | Read compliance evidence records | `services/backend-api`, `system.admin` users |
| `audit:read` | Read audit log records | `services/backend-api`, `system.admin` users |
| `audit:write` | Append an audit log entry | Any authenticated workload (append-only) |
| `tenant:read` | Read tenant-scoped data | Any workload with matching `tenant_id` |
| `tenant:write` | Write tenant-scoped data | Any workload with matching `tenant_id` |
| `admin:control-status` | Read compliance control status | `system.admin` role |
| `admin:evidence-export` | Export evidence for auditor | `system.admin` role |

## Claim Propagation

Claims are propagated across async boundaries via the `trace_id` on `MessageBus` (CloudEvents) events. Every agent that receives a claim and initiates a downstream call must:

1. Preserve the original `tenant_id` — never substitute or omit it.
2. Set `subject` to its own SPIFFE ID for the outbound call.
3. Reduce `expires_at` to no more than 2 minutes from the current time.
4. Include the original `trace_id` in the outbound CloudEvent.

## Tenant Isolation Invariant

A claim with `tenant_id: "org-A"` must never authorize access to data belonging to `tenant_id: "org-B"`. This is enforced at three layers:

1. **Database**: Supabase RLS policies require `organization_id` or `tenant_id` on every query.
2. **Memory**: Vector queries require `metadata.tenant_id` filter.
3. **Claim validation**: Middleware rejects claims where `tenant_id` does not match the authenticated session's organization.

Violation of this invariant is a P0 incident. See `docs/security-compliance/chaos-program.md` Scenario A.

## Claim Validation in Middleware

`serviceIdentityMiddleware` validates the workload identity (SPIFFE ID) but does not validate `tenant_id` — that is the responsibility of `tenantContext.ts` and RLS. The two layers are complementary:

| Layer | Validates |
|---|---|
| `serviceIdentityMiddleware` | Caller is a registered ValueOS workload with a valid SPIFFE ID |
| `tenantContext.ts` + RLS | Caller is authorized to access data for the requested `tenant_id` |

Both must pass for a request to succeed on protected routes.

## Claim Lifetime Policy

| Call type | Max TTL |
|---|---|
| Synchronous service-to-service | 2 minutes |
| Async agent handoff (CloudEvent) | 5 minutes |
| Audit/evidence write | 10 minutes |
| Admin API calls | 15 minutes |

Claims that arrive after `expires_at` are rejected with `401 Unauthorized`.

## Clock Skew Tolerance

Maximum allowed clock skew between issuer and validator: **2 minutes** (120,000 ms). This matches the `MAX_CLOCK_SKEW_MS` constant in `serviceIdentityMiddleware.ts`.

## Related Files

| File | Purpose |
|---|---|
| `docs/security-compliance/agent-identity-contract.md` | SPIFFE ID registry and trust domain |
| `docs/security-compliance/agent-handoff-allowlist.md` | Approved agent-to-agent handoffs |
| `packages/backend/src/middleware/serviceIdentityMiddleware.ts` | Workload identity validation |
| `packages/backend/src/middleware/tenantContext.ts` | Tenant claim validation |
| `packages/backend/src/services/realtime/MessageBus.ts` | CloudEvents claim propagation |
