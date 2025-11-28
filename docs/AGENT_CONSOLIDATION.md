# Agent System Consolidation

## Summary

This document describes the consolidation of the ValueCanvas agent architecture from a fragmented dual-framework system into a unified, stateless architecture.

## What Changed

### Phase 1: Unified Orchestration

**Before:** 4 separate orchestrators running in parallel
- `AgentOrchestrator` — Singleton with mutable state
- `StatelessAgentOrchestrator` — Concurrent-safe replacement
- `WorkflowOrchestrator` — DAG execution
- `CoordinatorAgent` — Task planning

**After:** Single `UnifiedAgentOrchestrator` that combines all capabilities

| New File | Purpose |
|----------|---------|
| `src/services/UnifiedAgentOrchestrator.ts` | Consolidated orchestrator with query processing, workflow execution, SDUI generation, and task planning |

**Deprecated Files:**
- `src/services/AgentOrchestrator.ts` — Marked deprecated, to be removed
- `src/services/StatelessAgentOrchestrator.ts` — Merged into unified

### Phase 2: Canonical Agent Interface

**New File:** `src/types/agent.ts`

Defines the canonical interface all agents should implement:

```typescript
interface IAgent {
  id: string;
  name: string;
  lifecycleStage: LifecycleStage;
  version: string;
  capabilities: string[];
  execute(input: AgentInput): Promise<AgentOutput>;
  canHandle(query: string, context?: Record<string, any>): boolean;
  getHealthStatus(): Promise<AgentHealthStatus>;
}
```

**Updated:** `src/services/AgentRegistry.ts` — Now uses canonical types with conversion helpers

### Phase 3: Unified API Layer

**New File:** `src/services/UnifiedAgentAPI.ts`

Consolidates:
- `AgentAPI` — HTTP client with circuit breaker
- `AgentFabricService` — Fabric processing
- `AgentQueryService` — Query handling

Features:
- Single circuit breaker per agent type
- Automatic routing (HTTP, local, mock)
- Consistent request/response format
- Full observability

**Updated:** `src/services/agent-types.ts` — Expanded `AgentType` union to include all agent types

### Phase 4: Feature Flags

**Updated:** `src/config/featureFlags.ts`

| Flag | Status | Default |
|------|--------|---------|
| `ENABLE_UNIFIED_ORCHESTRATION` | **NEW** | `true` |
| `ENABLE_STATELESS_ORCHESTRATION` | Deprecated | `false` |

### Phase 5: SDUI Consolidation

**Updated:** `src/services/AgentSDUIAdapter.ts`

| Method | Status |
|--------|--------|
| `processAgentOutputWithIntents()` | **PRIMARY** — Use for all new code |
| `processAgentOutput()` | Deprecated — Legacy switch-based |
| `analyzeImpact()` | Deprecated — Legacy method |

## Architecture Diagram

```
Bootstrap
    └── UnifiedAgentOrchestrator
            ├── AgentRegistry (all agents)
            ├── AgentRoutingLayer (DAG-based)
            └── UnifiedAgentAPI (circuit-broken)
                    └── IAgent implementations
                            └── IntentRegistry → SDUI
```

## Migration Guide

### For Orchestrator Users

**Before:**
```typescript
import { agentOrchestrator } from './AgentOrchestrator';
agentOrchestrator.processQuery(query);
```

**After:**
```typescript
import { agentOrchestrator } from './AgentOrchestratorAdapter';
// Same interface, uses unified orchestrator internally
agentOrchestrator.processQuery(query, { userId, sessionId });
```

### For New Agents

1. Implement `IAgent` interface from `src/types/agent.ts`
2. Register with `AgentRegistry`
3. Add intent mappings to `IntentRegistry` for SDUI

### For SDUI Integration

**Before:**
```typescript
adapter.processAgentOutput(agentId, output, workspaceId);
```

**After:**
```typescript
adapter.processAgentOutputWithIntents(agentId, output, workspaceId, tenantId);
```

## Files Created/Modified

### New Files
- `src/services/UnifiedAgentOrchestrator.ts`
- `src/services/UnifiedAgentAPI.ts`
- `src/types/agent.ts`
- `docs/AGENT_CONSOLIDATION.md`

### Modified Files
- `src/services/AgentOrchestrator.ts` — Added deprecation notice
- `src/services/AgentOrchestratorAdapter.ts` — Now uses unified orchestrator
- `src/services/AgentRegistry.ts` — Uses canonical types
- `src/services/AgentSDUIAdapter.ts` — Deprecation notices added
- `src/services/agent-types.ts` — Expanded AgentType union
- `src/config/featureFlags.ts` — Added ENABLE_UNIFIED_ORCHESTRATION

## Backward Compatibility

The `AgentOrchestratorAdapter` maintains full backward compatibility:
- Same public interface as before
- Internally routes to `UnifiedAgentOrchestrator`
- Legacy methods continue to work during migration

## Next Steps

1. **Monitor:** Watch for issues with unified orchestration in production
2. **Migrate:** Update remaining callers to use new interfaces
3. **Remove:** Delete deprecated code after migration period
4. **Test:** Add integration tests for unified orchestrator

## Environment Variables

```bash
# Enable unified orchestration (default: true)
VITE_ENABLE_UNIFIED_ORCHESTRATION=true

# Deprecated - no longer used when unified is enabled
VITE_ENABLE_STATELESS_ORCHESTRATION=false
```
