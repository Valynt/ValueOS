# Adapter Boundary Contract (Execution Runtime)

This document defines the enforceable boundary between orchestration/runtime code and infrastructure adapters.

## 1) What orchestration code may know

Orchestration code may depend on:

- **Domain DTOs** (request/response shapes needed for runtime decisions)
- **Policy outcomes** (allow/deny results, constraints)
- **Typed failures** (machine-readable failure codes and retryability)

Orchestration code must **not** depend on transport details, SQL primitives, credential wiring, or retry internals.

## 2) What adapter implementations own

Adapters are responsible for:

- **Transport and DB details** (HTTP/Supabase/BullMQ specifics)
- **Auth credentials/mode** (e.g. user-scoped RLS vs service-role)
- **Retry mechanics** (attempt strategy and backoff behavior)

This keeps runtime decisioning pure and testable while infra concerns remain localized.

## 3) Mandatory adapter-layer controls

Every adapter invocation must include and enforce:

1. **Tenant scoping assertions** (request tenant must match execution tenant)
2. **Structured log schema** (`valueos.adapter.log.v1`)
3. **Retry/backoff policy** (declared per invocation)
4. **Auth mode declaration** (`user-scoped-rls`, `service-role`, `system-worker`)

## 4) Executable contract

Code-level contract and decorators live in:

- `packages/backend/src/runtime/ports/Contract.ts`
- `packages/backend/src/runtime/ports/decorators/adapterDecorators.ts`

The wrappers are intentionally thin:

- `withTenantScopeGuard(...)`
- `withStructuredLogging(...)`
- `withRetry(...)`

## 5) First migrated path

The first migrated runtime path is workflow failure persistence in:

- `packages/backend/src/runtime/execution-runtime/state-persistence.ts`
- `packages/backend/src/runtime/execution-runtime/adapters/WorkflowFailureSupabaseAdapter.ts`

`WorkflowStatePersistence.handleWorkflowFailure(...)` now calls a decorated adapter chain instead of issuing a raw Supabase update directly.
