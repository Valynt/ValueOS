# Orchestrator Consolidation Plan - Sprint 1

**Status:** 60% Complete  
**Target:** Single production orchestrator  
**Timeline:** Days 2-5 of Sprint 1  
**Risk Level:** Medium (mitigated by adapter layer)

---

## Executive Summary

The codebase has **6 orchestrator implementations** (3,192 LOC). Consolidation to **UnifiedAgentOrchestrator** is 60% complete. Remaining work: migrate 3 files, merge 2 features, remove 2 deprecated files.

---

## Current State Analysis

### Orchestrator Inventory

| Orchestrator | LOC | Status | Usage | Action |
|--------------|-----|--------|-------|--------|
| **UnifiedAgentOrchestrator** | 955 | ✅ Active | Primary | **KEEP - Production** |
| **AgentOrchestratorAdapter** | 248 | ✅ Active | Compatibility | **KEEP - Adapter** |
| **WorkflowOrchestrator** | 1,112 | ⚠️ Partial | Simulation/Guardrails | **MERGE** features |
| **ValueLifecycleOrchestrator** | 253 | ⚠️ Specialized | Saga pattern | **KEEP - Specialized** |
| **AgentOrchestrator** | 424 | ❌ Deprecated | ActionRouter only | **REMOVE** |
| **StatelessAgentOrchestrator** | 200 | ❌ Merged | AgentQueryService only | **REMOVE** |

**Total:** 3,192 LOC → Target: ~1,900 LOC (40% reduction)

### Current Usage Map

```
Components:
├── MainLayout.tsx → AgentOrchestratorAdapter ✅
├── ChatCanvasLayout.tsx → UnifiedAgentOrchestrator ✅
├── WorkflowErrorPanel.tsx → WorkflowOrchestrator ⚠️
└── StreamingIndicator.tsx → AgentOrchestrator (deprecated) ❌

Services:
├── ActionRouter.ts → AgentOrchestrator + WorkflowOrchestrator ❌
├── AgentQueryService.ts → StatelessAgentOrchestrator ❌
├── PlaygroundWorkflowAdapter.ts → WorkflowOrchestrator ⚠️
└── WorkflowLifecycleIntegration.ts → ValueLifecycleOrchestrator ✅
```

---

## Recommended Production Orchestrator

### **UnifiedAgentOrchestrator** ✅

**Why:**
- ✅ Consolidates 4 orchestrators into one
- ✅ Stateless design (safe for concurrent requests)
- ✅ Well-tested (13,721 LOC of tests)
- ✅ Observable (full tracing and audit logging)
- ✅ Extensible (plugin architecture)
- ✅ Already in production via adapter

**Capabilities:**
- Query processing with routing
- Workflow DAG execution
- SDUI generation
- Task planning
- Circuit breaker integration
- Memory system integration
- Audit logging

**Access Pattern:**
```typescript
// For new code
import { getUnifiedOrchestrator } from './services/UnifiedAgentOrchestrator';
const orchestrator = getUnifiedOrchestrator();

// For legacy code (backward compatible)
import { agentOrchestrator } from './services/AgentOrchestratorAdapter';
```

---

## Migration Plan (Days 2-5)

### **Day 2: Migrate ActionRouter.ts** (4 hours)

**Current State:**
```typescript
import { AgentOrchestrator } from './AgentOrchestrator';
import { WorkflowOrchestrator } from './WorkflowOrchestrator';

const agentOrch = new AgentOrchestrator();
const workflowOrch = new WorkflowOrchestrator();
```

**Target State:**
```typescript
import { getUnifiedOrchestrator } from './UnifiedAgentOrchestrator';

const orchestrator = getUnifiedOrchestrator();
```

**Steps:**
1. Update imports
2. Replace `agentOrch.processQuery()` with `orchestrator.processQuery()`
3. Replace `workflowOrch.executeWorkflow()` with `orchestrator.executeWorkflow()`
4. Update state management (pass state as parameter)
5. Run tests: `npm test -- ActionRouter.test.ts`

**Validation:**
- [ ] ActionRouter.test.ts passes
- [ ] No references to deprecated AgentOrchestrator
- [ ] Backward compatibility maintained

---

### **Day 2: Migrate AgentQueryService.ts** (3 hours)

**Current State:**
```typescript
import { StatelessAgentOrchestrator } from './StatelessAgentOrchestrator';

private orchestrator = new StatelessAgentOrchestrator();
```

**Target State:**
```typescript
import { getUnifiedOrchestrator } from './UnifiedAgentOrchestrator';

private orchestrator = getUnifiedOrchestrator();
```

**Steps:**
1. Update imports
2. Replace method calls (signatures are compatible)
3. Update state handling
4. Run tests: `npm test -- AgentQueryService.test.ts`

**Validation:**
- [ ] AgentQueryService.test.ts passes
- [ ] No references to StatelessAgentOrchestrator
- [ ] Session management still works

---

### **Day 3: Update StreamingIndicator.tsx** (1 hour)

**Current State:**
```typescript
import { StreamingUpdate } from '../../services/AgentOrchestrator';
```

**Target State:**
```typescript
import { StreamingUpdate } from '../../services/UnifiedAgentOrchestrator';
```

**Steps:**
1. Update import path
2. Verify types are compatible
3. Run component tests

**Validation:**
- [ ] Component renders correctly
- [ ] Streaming updates work
- [ ] No TypeScript errors

---

### **Day 4: Merge WorkflowOrchestrator Features** (8 hours)

**Features to Merge:**

#### 1. Simulation Capabilities
**Location:** `WorkflowOrchestrator.simulateWorkflow()`

**Target:** Add to `UnifiedAgentOrchestrator`
```typescript
async simulateWorkflow(
  workflowDefinitionId: string,
  context: Record<string, unknown>
): Promise<SimulationResult>
```

**Steps:**
1. Copy simulation logic from WorkflowOrchestrator
2. Add to UnifiedAgentOrchestrator class
3. Update tests
4. Update WorkflowErrorPanel.tsx to use unified orchestrator

#### 2. Guardrails Integration
**Location:** `WorkflowOrchestrator` autonomy checks

**Target:** Add to `UnifiedAgentOrchestrator`
```typescript
private async checkAutonomyGuardrails(
  stage: WorkflowStage,
  context: Record<string, unknown>
): Promise<boolean>
```

**Steps:**
1. Copy guardrails logic
2. Integrate with existing circuit breaker
3. Add configuration options
4. Update tests

**Validation:**
- [ ] Simulation tests pass
- [ ] Guardrails tests pass
- [ ] WorkflowErrorPanel.tsx works with unified orchestrator
- [ ] PlaygroundWorkflowAdapter.ts works with unified orchestrator

---

### **Day 5: Cleanup and Validation** (4 hours)

#### 1. Remove Deprecated Files
```bash
# Backup first
git mv src/services/AgentOrchestrator.ts src/services/_deprecated/
git mv src/services/StatelessAgentOrchestrator.ts src/services/_deprecated/

# Or delete if confident
rm src/services/AgentOrchestrator.ts
rm src/services/StatelessAgentOrchestrator.ts
```

#### 2. Update Exports
**File:** `src/services/index.ts`
```typescript
// Remove
export { AgentOrchestrator } from './AgentOrchestrator';
export { StatelessAgentOrchestrator } from './StatelessAgentOrchestrator';

// Keep
export { UnifiedAgentOrchestrator, getUnifiedOrchestrator } from './UnifiedAgentOrchestrator';
export { agentOrchestrator } from './AgentOrchestratorAdapter';
export { WorkflowOrchestrator, workflowOrchestrator } from './WorkflowOrchestrator'; // Temporary
export { ValueLifecycleOrchestrator } from './ValueLifecycleOrchestrator';
```

#### 3. Run Full Test Suite
```bash
npm test
```

#### 4. Update Documentation
- [ ] Update SPRINT_1_PROGRESS.md
- [ ] Update architecture docs
- [ ] Create ADR (Architectural Decision Record)

---

## Validation Checklist

### Code Quality
- [ ] Zero references to `AgentOrchestrator` (except adapter)
- [ ] Zero references to `StatelessAgentOrchestrator`
- [ ] All imports use `UnifiedAgentOrchestrator` or `AgentOrchestratorAdapter`
- [ ] No TypeScript errors
- [ ] No lint errors in modified files

### Functionality
- [ ] All 162 test files run (may have failures, but run)
- [ ] ActionRouter tests pass
- [ ] AgentQueryService tests pass
- [ ] WorkflowOrchestrator tests pass
- [ ] UI components render correctly

### Performance
- [ ] No performance regressions
- [ ] Circuit breakers work
- [ ] Memory usage stable

### Documentation
- [ ] Migration guide updated
- [ ] Architecture diagrams updated
- [ ] Sprint progress documented

---

## Rollback Plan

If critical issues arise:

### Option 1: Feature Flag Rollback
```typescript
// In featureFlags.ts
export const featureFlags = {
  ENABLE_UNIFIED_ORCHESTRATION: false, // Revert to adapter
};
```

### Option 2: Git Revert
```bash
git revert <commit-hash>
git push origin main
```

### Option 3: Restore Deprecated Files
```bash
git checkout HEAD~1 -- src/services/AgentOrchestrator.ts
git checkout HEAD~1 -- src/services/StatelessAgentOrchestrator.ts
```

---

## Success Metrics

### Quantitative
- ✅ **Code Reduction:** 3,192 LOC → ~1,900 LOC (40% reduction)
- ✅ **File Reduction:** 6 orchestrators → 2 (primary + specialized)
- ✅ **Test Coverage:** Maintain ≥70% coverage
- ✅ **Performance:** No regression (P95 latency)

### Qualitative
- ✅ **Maintainability:** Single source of truth
- ✅ **Clarity:** Clear architecture boundaries
- ✅ **Testability:** Consolidated test suite
- ✅ **Developer Experience:** Simpler API

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing integrations | Medium | High | Adapter layer, feature flags |
| Test failures | High | Medium | Fix P0 failures, defer P1/P2 |
| Performance regression | Low | High | Benchmark before/after |
| Incomplete migration | Medium | Medium | Clear checklist, validation |

**Overall Risk:** Medium (well-mitigated)

---

## Timeline Summary

| Day | Task | Hours | Status |
|-----|------|-------|--------|
| Day 2 | Migrate ActionRouter.ts | 4 | ⏳ Pending |
| Day 2 | Migrate AgentQueryService.ts | 3 | ⏳ Pending |
| Day 3 | Update StreamingIndicator.tsx | 1 | ⏳ Pending |
| Day 4 | Merge WorkflowOrchestrator features | 8 | ⏳ Pending |
| Day 5 | Cleanup and validation | 4 | ⏳ Pending |
| **Total** | | **20 hours** | |

**Buffer:** 4 hours for unexpected issues  
**Total Estimated:** 24 hours (3 days)

---

## Next Steps

1. **Review this plan** with team
2. **Create feature branch:** `sprint-1/orchestrator-consolidation`
3. **Start Day 2 tasks:** Migrate ActionRouter.ts
4. **Daily standup:** Report progress, blockers
5. **End of Day 5:** Merge to main if all validations pass

---

## Questions & Decisions

### Q: Should we keep ValueLifecycleOrchestrator?
**A:** Yes. It's well-designed, has clear boundaries, and serves a specific purpose (saga pattern with compensation). Not worth merging.

### Q: Should we keep WorkflowOrchestrator temporarily?
**A:** Yes, but only until simulation and guardrails are merged (1-2 sprints). Then deprecate.

### Q: What about backward compatibility?
**A:** AgentOrchestratorAdapter provides full backward compatibility. No breaking changes for existing code.

### Q: What if tests fail?
**A:** Triage failures. Fix P0 (blockers), document P1/P2 for later sprints. Goal is working baseline, not 100% passing tests.

---

**Last Updated:** 2025-12-13 04:50 UTC  
**Owner:** Sprint 1 Team  
**Reviewers:** Engineering Lead, Architecture Team
