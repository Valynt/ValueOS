# Spec: Sprint 49 — Test Stabilization + Value Graph Agent Integration + API

## Problem Statement

Three distinct gaps block Sprint 49 delivery:

1. **~120 backend test files crash at module-init time** because their `vi.mock` for the logger omits `createLogger`. Source files call `createLogger({ component: '...' })` at the top level; when a transitive import hits a mock that doesn't export `createLogger`, Vitest throws before any test runs. This is a pre-existing infrastructure gap that must be resolved before Sprint 49 agent tests can be written.

2. **Five agents have no Value Graph integration.** `NarrativeAgent`, `TargetAgent`, `RealizationAgent`, `ExpansionAgent`, and `ComplianceAuditorAgent` do not read from or write to `ValueGraphService`. Sprint 48 identified two classes of silent failure in the first two agents: (a) wrong context key used to extract `opportunity_id`, causing writes to the wrong entity; (b) non-UUID string fallbacks hitting UUID Postgres columns and crashing writes silently. A shared `BaseGraphWriter` utility must enforce these invariants so the five new agents cannot repeat the same bugs.

3. **The 7 Value Graph API endpoints do not exist.** Sprint 49 requires a new router at `/api/v1/graph/:opportunityId/` with authentication, tenant context, and an explicit opportunity-ownership check before any handler executes.

---

## Requirements

### 1. Global Logger Mock in `packages/backend/src/test/setup.ts`

**Behaviour:** Add a global `vi.mock` for both logger module paths that provides `createLogger` as a `vi.fn()` returning a full mock logger object. The mock must be **overridable** — per-test `vi.mock` calls in individual files continue to take precedence, preserving existing high-fidelity assertions (e.g. `GuestAccessService.test.ts`).

**Paths to mock globally:**
- `../../lib/logger` (and `.js` variant) — the backend's own structured logger
- `@shared/lib/logger` — the shared package logger

**Mock shape** (must match both loggers' exported surface):

```typescript
{
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), cache: vi.fn() },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), cache: vi.fn() },
}
```

**Reset:** `vi.clearAllMocks()` already runs in `afterEach` — no additional reset needed.

**Constraint:** Do not remove or modify any existing per-test `vi.mock` calls. The global mock is a safety net, not a replacement.

---

### 2. `BaseGraphWriter` Utility

**Location:** `packages/backend/src/lib/agent-fabric/BaseGraphWriter.ts`

**Purpose:** A class that agents compose to write nodes and edges to the Value Graph. It enforces three invariants that prevented silent failures in Sprint 48.

#### 2a. Canonical Context Extraction

Expose a `protected getSafeContext(context: LifecycleContext): { opportunityId: string; organizationId: string }` method.

- Extract `opportunity_id` from `context.user_inputs` or `context.metadata`. If missing or not a valid UUID v4, throw `LifecycleContextError` with a descriptive message — never fall back to `workspace_id` or any other key.
- Extract `organization_id` from `context.organization_id`. If missing or not a valid UUID v4, throw.

#### 2b. Safe UUID Generation

Expose a `protected generateNodeId(deterministicInput?: string): string` helper.

- If `deterministicInput` is provided and is already a valid UUID v4, return it as-is.
- Otherwise, call `crypto.randomUUID()` — never pass a raw string fallback to a UUID column.

#### 2c. Atomic Write Isolation

Expose a `protected async safeWriteBatch(writes: Array<() => Promise<unknown>>): Promise<{ succeeded: number; failed: number; errors: Error[] }>` method.

- Uses `Promise.allSettled` internally so one failed write does not abort the remaining writes.
- Logs each failure with `logger.error` including the write index and error message.
- Returns a summary object; callers decide whether to surface partial failure to the agent output.

#### 2d. Convenience write methods

Thin wrappers over `ValueGraphService` that call `getSafeContext` before delegating:

- `writeCapability(context, input: Omit<WriteCapabilityInput, 'opportunity_id' | 'organization_id'>): Promise<VgCapability>`
- `writeMetric(context, input: Omit<WriteMetricInput, 'opportunity_id' | 'organization_id'>): Promise<VgMetric>`
- `writeValueDriver(context, input: Omit<WriteValueDriverInput, 'opportunity_id' | 'organization_id'>): Promise<VgValueDriver>`
- `writeEdge(context, input: Omit<WriteEdgeInput, 'opportunity_id' | 'organization_id'>): Promise<ValueGraphEdge>`

**Dependencies:** `ValueGraphService` injected via constructor for testability; defaults to the singleton `valueGraphService`.

**Error type:** Export `LifecycleContextError extends Error` from the same file.

---

### 3. Five Agent Integrations (Sprint 49 KR 1)

Wire each of the five agents to the Value Graph using `BaseGraphWriter`. Each agent:

- Composes `BaseGraphWriter` (not extends — agents already extend `BaseAgent`).
- Calls `getSafeContext(context)` at the start of its graph-write phase.
- Uses `safeWriteBatch` for all node/edge writes.
- Has a unit test asserting expected node types and edge types are written after a successful run (mock `ValueGraphService`).

**Per-agent graph writes:**

| Agent | Writes |
|---|---|
| `NarrativeAgent` | `VgValueDriver` nodes; `metric_maps_to_value_driver` edges |
| `TargetAgent` | `VgMetric` nodes (KPI targets); `capability_impacts_metric` edges |
| `RealizationAgent` | `VgMetric` nodes (actuals vs targets); `metric_maps_to_value_driver` edges |
| `ExpansionAgent` | `VgCapability` nodes; `use_case_enabled_by_capability` edges |
| `ComplianceAuditorAgent` | `VgValueDriver` nodes (compliance risk drivers); `hypothesis_claims_metric` edges |

---

### 4. Value Graph API Router (Sprint 49 KR 2)

**File:** `packages/backend/src/api/valueGraph.ts`

**Mount point:** `/api/v1/graph` in `server.ts`

**Middleware chain on all routes:**

```
requireAuth → tenantContextMiddleware() → tenantDbContextMiddleware() → validateOpportunityAccess
```

#### 4a. `validateOpportunityAccess` middleware

**File:** `packages/backend/src/middleware/validateOpportunityAccess.ts`

- Reads `req.params.opportunityId`.
- Queries `value_cases` for `{ organization_id }` where `id = opportunityId`, using `req.supabase` (tenant-scoped client set by `tenantDbContextMiddleware`).
- Returns `403 { error: "Access to this Value Graph is denied." }` if not found or `organization_id !== req.tenantId`.
- On success, attaches `req.opportunityId = opportunityId`.
- Add `opportunityId: string` to `packages/backend/src/types/express.d.ts`.

#### 4b. The 7 endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/graph/:opportunityId/summary` | Node/edge counts by type from `getGraphForOpportunity` |
| `GET` | `/api/v1/graph/:opportunityId/nodes` | Paginated nodes; `?entity_type=` filter supported |
| `GET` | `/api/v1/graph/:opportunityId/export` | Full graph JSON (nodes + edges) |
| `GET` | `/api/v1/graph/:opportunityId/paths` | Value paths from `getValuePaths()` |
| `POST` | `/api/v1/graph/:opportunityId/edges` | Manually create an edge; Zod-validated body |
| `PATCH` | `/api/v1/graph/:opportunityId/nodes/:nodeId` | Update node metadata; Zod-validated body |
| `DELETE` | `/api/v1/graph/:opportunityId/nodes/:nodeId` | Remove node; writes audit log entry via `AuditLogger` |

All responses include `organization_id` and `opportunity_id`.

**OpenAPI:** Update `packages/backend/openapi.yaml` with all 7 paths.

---

## Acceptance Criteria

### Item 1 — Global Logger Mock
- `pnpm --filter backend test` produces zero `[vitest] No "createLogger" export is defined` errors.
- `GuestAccessService.test.ts` and other tests with custom `vi.hoisted` logger spies continue to pass with their spy assertions intact.
- Net failing test count in `@valueos/backend` is materially reduced from ~284.

### Item 2 — `BaseGraphWriter`
- `LifecycleContextError` is thrown (not swallowed) when `opportunity_id` is missing or not a UUID.
- `generateNodeId` never returns a non-UUID string.
- `safeWriteBatch` with one failing write commits the remaining writes and returns `{ succeeded: N-1, failed: 1, errors: [...] }`.
- Unit tests for all three invariants pass.

### Item 3 — Five Agent Integrations
- Each agent has a test asserting expected node and edge types are written after a successful run.
- No agent calls `ValueGraphService` methods directly — all writes go through `BaseGraphWriter`.
- `pnpm test` green for all five agent test files.

### Item 4 — Value Graph API
- All 7 endpoints return `401` when unauthenticated.
- All 7 endpoints return `403` when `opportunityId` belongs to a different tenant.
- Read endpoints return correct data shapes from `ValueGraphService`.
- Write/mutate endpoints return `400` on invalid Zod input.
- `DELETE /nodes/:nodeId` writes an audit log entry.
- `pnpm test` green for the new router test file.
- `openapi.yaml` updated with all 7 paths.

---

## Implementation Order

1. **Global logger mock in `setup.ts`** — verify zero `createLogger` errors before proceeding.
2. **`LifecycleContextError` + `BaseGraphWriter`** — implement and unit-test all three invariants.
3. **`NarrativeAgent` graph integration** — first agent, establishes the composition pattern.
4. **`TargetAgent`, `RealizationAgent`, `ExpansionAgent`, `ComplianceAuditorAgent` graph integrations** — follow the same pattern.
5. **`validateOpportunityAccess` middleware** — implement and unit-test in isolation.
6. **Value Graph API router** — implement all 7 endpoints, wire middleware chain, mount in `server.ts`.
7. **Update `express.d.ts`** — add `opportunityId: string` to `Request`.
8. **Update `openapi.yaml`** — add all 7 paths.
9. **Run `pnpm test`** — verify green across all new and modified files.

---

## Out of Scope

- Sprint 50 UI components (`ValueGraphVisualization`, `ValuePathCard`, `MetricCard`).
- `IntegrityAgentService` TypeScript errors (12 errors in `post-v1/IntegrityAgentService.ts`) — separate fix.
- `ComplianceControlStatusService` lazy-init Supabase fix — separate fix.
- Other pre-existing backend test failures not caused by the `createLogger` mock gap.
