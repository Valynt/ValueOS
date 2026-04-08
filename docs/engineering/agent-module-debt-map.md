# Agent Module Debt Map (Canonical vs Shim)

## Module map

| Module | Role | Canonical destination | Status |
|---|---|---|---|
| `packages/backend/src/types/agent.ts` | Canonical agent domain types | self | Canonical (keep) |
| `packages/backend/src/services/types/agent.ts` | Legacy shim for service-local imports | `packages/backend/src/types/agent.ts` (+ `services/agent-types.ts`) | Deprecated shim; migrate imports in batches |
| `packages/backend/src/services/post-v1/UnifiedAgentAPI.ts` | Legacy post-v1 shim | `packages/backend/src/services/value/UnifiedAgentAPI.ts` | Deprecated shim; no new imports |
| `packages/backend/src/services/UnifiedAgentAPI.ts` | Legacy flat service shim | `packages/backend/src/services/value/UnifiedAgentAPI.ts` | Deprecated shim; no new imports |

## Batch migration completed in this change

1. **Types migration batch**: moved active imports from `services/types/agent` to canonical `src/types/agent` in:
   - `services/llm/ModelService.ts`
   - `services/value/UnifiedAgentAPI.ts`
   - `services/post-v1/ValueLifecycleOrchestrator.ts`
2. **UnifiedAgentAPI migration batch**: moved active imports from shim paths to `services/value/UnifiedAgentAPI` in:
   - `services/agents/AgentExecutorService.ts`
   - `services/post-v1/IntelligentCoordinator.ts`
   - `services/post-v1/EnhancedParallelExecutor.ts`
   - targeted tests under `src/services/__tests__` and `src/api/__tests__`.

## Guardrail

ESLint `no-restricted-imports` now blocks new imports of:
- `services/types/agent` shim paths
- `services/UnifiedAgentAPI` shim path
- `services/post-v1/UnifiedAgentAPI` shim path

## Progressive reduction targets (April 2026)

| File | Current size | Target size | Primary ownership | Extraction seam(s) tracked |
|---|---:|---:|---|---|
| `packages/backend/src/server.ts` | 836 LOC | ≤ 850 LOC | Backend Platform | `server/websocket-request-auth.ts`, `server/register-routes.ts`, `server/register-middleware.ts` extracted; continue trimming startup/shutdown orchestration helpers as needed |
| `packages/backend/src/runtime/execution-runtime/WorkflowExecutor.ts` | 1364 LOC | ≤ 1100 LOC | Runtime Orchestration | `workflow-stage-output-schema.ts` (scenario stage schema guard), policy-check seam extraction next |
| `packages/backend/src/services/tenant/TenantPerformanceManager.ts` | 1287 LOC | ≤ 1000 LOC | Tenant Services | `TenantPerformancePolicy.ts` (tier limits/SLA/weights/defaults), alert/index management seams next |
