# post-v1 Services

Services in this directory are deferred — they are not part of the v1 launch scope and must not be imported at startup unless their feature flag is explicitly enabled.

See `packages/backend/src/config/v1-service-scope.ts` for the authoritative list.

Do not add new imports of these files to routes, server.ts, or any v1 service without first moving the service to the active `services/` directory and updating `v1-service-scope.ts`.


## Agent-Orchestration Classification (Phase 1)

| File | Classification | Target destination | Notes |
|---|---|---|---|
| `UnifiedAgentAPI.ts` | Migration candidate (shim) | `../value/UnifiedAgentAPI.ts` | Deprecated re-export; no new direct imports. |
| `IntelligentCoordinator.ts` | Migration candidate | `../workflows/` (orchestrator domain) | Uses canonical `value/UnifiedAgentAPI`; move when orchestrator wiring is resumed. |
| `EnhancedParallelExecutor.ts` | Still required | `../runtime/execution-runtime/` | Imported by `WorkflowExecutor`; active runtime dependency. |
| `ValueLifecycleOrchestrator.ts` | Still required | `../workflows/` | Imported by `api/valueCases/backHalf.ts`; active endpoint path. |

Migration rule for this cluster: import canonical value-agent API from `services/value/UnifiedAgentAPI` and canonical agent domain types from `src/types/agent`.
