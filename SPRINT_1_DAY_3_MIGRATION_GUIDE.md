# Sprint 1, Day 3: Orchestrator Migration Guide

**Objective:** Migrate 3 files from deprecated orchestrators to UnifiedAgentOrchestrator  
**Estimated Time:** 8 hours  
**Status:** Ready to execute

---

## Files to Migrate

### 1. StreamingIndicator.tsx ✅ COMPLETE

**File:** `src/components/Agent/StreamingIndicator.tsx`  
**Change:** Import path only  
**Time:** 5 minutes

**Before:**
```typescript
import { StreamingUpdate } from '../../services/AgentOrchestrator';
```

**After:**
```typescript
import { StreamingUpdate } from '../../services/UnifiedAgentOrchestrator';
```

**Status:** ✅ Already migrated

---

### 2. ActionRouter.ts (4 hours)

**File:** `src/services/ActionRouter.ts`  
**Complexity:** Medium - requires constructor and method updates

#### Step 1: Update Imports

**Before:**
```typescript
import { AgentOrchestrator } from './AgentOrchestrator';
import { WorkflowOrchestrator } from './WorkflowOrchestrator';
```

**After:**
```typescript
import { getUnifiedOrchestrator, UnifiedAgentOrchestrator } from './UnifiedAgentOrchestrator';
```

#### Step 2: Update Class Properties

**Before:**
```typescript
export class ActionRouter {
  private handlers: Map<string, ActionHandler>;
  private auditLogService: AuditLogService;
  private agentOrchestrator: AgentOrchestrator;
  private workflowOrchestrator: WorkflowOrchestrator;
  private componentMutationService: ComponentMutationService;
```

**After:**
```typescript
export class ActionRouter {
  private handlers: Map<string, ActionHandler>;
  private auditLogService: AuditLogService;
  private orchestrator: UnifiedAgentOrchestrator;
  private componentMutationService: ComponentMutationService;
```

#### Step 3: Update Constructor

**Before:**
```typescript
constructor(
  auditLogService?: AuditLogService,
  agentOrchestrator?: AgentOrchestrator,
  workflowOrchestrator?: WorkflowOrchestrator,
  componentMutationService?: ComponentMutationService
) {
  this.handlers = new Map();
  this.auditLogService = auditLogService || new AuditLogService();
  this.agentOrchestrator = agentOrchestrator || new AgentOrchestrator();
  this.workflowOrchestrator = workflowOrchestrator || new WorkflowOrchestrator();
  this.componentMutationService = componentMutationService || new ComponentMutationService();

  this.registerDefaultHandlers();
}
```

**After:**
```typescript
constructor(
  auditLogService?: AuditLogService,
  orchestrator?: UnifiedAgentOrchestrator,
  componentMutationService?: ComponentMutationService
) {
  this.handlers = new Map();
  this.auditLogService = auditLogService || new AuditLogService();
  this.orchestrator = orchestrator || getUnifiedOrchestrator();
  this.componentMutationService = componentMutationService || new ComponentMutationService();

  this.registerDefaultHandlers();
}
```

#### Step 4: Update Method Calls

Find all references to `this.agentOrchestrator` and `this.workflowOrchestrator` and replace with `this.orchestrator`.

**Common patterns:**

```typescript
// Agent query processing
// Before:
const response = await this.agentOrchestrator.processQuery(query, context);

// After:
const response = await this.orchestrator.processQuery(
  query,
  currentState,
  context.userId,
  context.sessionId,
  traceId
);
```

```typescript
// Workflow execution
// Before:
const executionId = await this.workflowOrchestrator.executeWorkflow(
  workflowId,
  context
);

// After:
const result = await this.orchestrator.executeWorkflow(
  workflowId,
  context
);
const executionId = result.executionId;
```

#### Step 5: Update Handler Registration

In `registerDefaultHandlers()`, update any handlers that reference the old orchestrators.

#### Step 6: Test

```bash
npm test -- ActionRouter.test.ts
```

**Expected:** Tests pass or have clear failures to fix

---

### 3. AgentQueryService.ts (3 hours)

**File:** `src/services/AgentQueryService.ts`  
**Complexity:** Low - mostly import and property changes

#### Step 1: Update Imports

**Before:**
```typescript
import { StatelessAgentOrchestrator, AgentResponse } from './StatelessAgentOrchestrator';
```

**After:**
```typescript
import { getUnifiedOrchestrator, UnifiedAgentOrchestrator, AgentResponse } from './UnifiedAgentOrchestrator';
```

#### Step 2: Update Class Property

**Before:**
```typescript
export class AgentQueryService {
  private orchestrator = new StatelessAgentOrchestrator();
  private supabase: SupabaseClient;
```

**After:**
```typescript
export class AgentQueryService {
  private orchestrator = getUnifiedOrchestrator();
  private supabase: SupabaseClient;
```

#### Step 3: Update Method Calls

The method signatures are compatible, but you may need to adjust state handling:

**Before:**
```typescript
async processQuery(
  query: string,
  currentState: WorkflowState,
  userId: string,
  sessionId: string
): Promise<ProcessQueryResult> {
  const traceId = uuidv4();
  
  return await this.orchestrator.processQuery(
    query,
    currentState,
    userId,
    sessionId,
    traceId
  );
}
```

**After:**
```typescript
async processQuery(
  query: string,
  currentState: WorkflowState,
  userId: string,
  sessionId: string
): Promise<ProcessQueryResult> {
  const traceId = uuidv4();
  
  // Method signature is the same
  return await this.orchestrator.processQuery(
    query,
    currentState,
    userId,
    sessionId,
    traceId
  );
}
```

#### Step 4: Test

```bash
npm test -- AgentQueryService.test.ts
```

---

## Validation Checklist

After completing all migrations:

### Code Quality
- [ ] No references to `AgentOrchestrator` (except in deprecated file)
- [ ] No references to `StatelessAgentOrchestrator` (except in deprecated file)
- [ ] No references to `WorkflowOrchestrator` in ActionRouter
- [ ] All imports use `UnifiedAgentOrchestrator` or `AgentOrchestratorAdapter`
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] No lint errors in modified files: `npm run lint`

### Functionality
- [ ] ActionRouter.test.ts passes
- [ ] AgentQueryService.test.ts passes
- [ ] StreamingIndicator renders correctly
- [ ] UI components still work (manual test)

### Git
- [ ] Changes committed with clear message
- [ ] Co-authored-by: Ona <no-reply@ona.com>

---

## Common Issues & Solutions

### Issue 1: Type Mismatches

**Problem:** `processQuery` return type doesn't match

**Solution:** UnifiedAgentOrchestrator returns `ProcessQueryResult` which includes:
```typescript
{
  response: AgentResponse | null;
  nextState: WorkflowState;
  traceId: string;
}
```

Update calling code to destructure:
```typescript
const { response, nextState } = await orchestrator.processQuery(...);
```

### Issue 2: Workflow Execution Return Type

**Problem:** Old `WorkflowOrchestrator.executeWorkflow()` returned `string` (executionId), new returns `WorkflowExecutionResult`

**Solution:**
```typescript
// Before:
const executionId = await workflowOrchestrator.executeWorkflow(id, context);

// After:
const result = await orchestrator.executeWorkflow(id, context);
const executionId = result.executionId;
```

### Issue 3: State Management

**Problem:** Old orchestrators had internal state, new one is stateless

**Solution:** Pass state explicitly:
```typescript
// Create initial state if needed
const initialState = orchestrator.createInitialState('opportunity', context);

// Pass state to all operations
const result = await orchestrator.processQuery(query, initialState, ...);

// Use returned nextState for subsequent operations
const nextResult = await orchestrator.processQuery(query2, result.nextState, ...);
```

---

## Testing Strategy

### Unit Tests
```bash
# Test individual files
npm test -- ActionRouter.test.ts
npm test -- AgentQueryService.test.ts

# Test all orchestrator-related tests
npm test -- --grep "orchestrator"
```

### Integration Tests
```bash
# Test full workflow
npm test -- --grep "workflow"

# Test agent integration
npm test -- --grep "agent.*integration"
```

### Manual Testing
1. Start dev server: `npm run dev`
2. Open browser to localhost:5173
3. Test agent query in MainLayout
4. Test workflow execution in WorkflowErrorPanel
5. Verify streaming indicators appear

---

## Rollback Procedure

If critical issues arise:

### Quick Rollback (Feature Flag)
```typescript
// In featureFlags.ts
export const featureFlags = {
  ENABLE_UNIFIED_ORCHESTRATION: false,
};
```

### Full Rollback (Git)
```bash
git revert HEAD
git push origin main
```

### Partial Rollback (Single File)
```bash
git checkout HEAD~1 -- src/services/ActionRouter.ts
git commit -m "Rollback ActionRouter migration"
```

---

## Time Estimates

| Task | Estimated | Buffer | Total |
|------|-----------|--------|-------|
| StreamingIndicator.tsx | 5 min | - | 5 min ✅ |
| ActionRouter.ts | 3 hours | 1 hour | 4 hours |
| AgentQueryService.ts | 2 hours | 1 hour | 3 hours |
| Testing & Validation | 30 min | 30 min | 1 hour |
| **Total** | **5.5 hours** | **2.5 hours** | **8 hours** |

---

## Success Criteria

- ✅ All 3 files migrated
- ✅ No references to deprecated orchestrators
- ✅ Tests pass (or failures documented)
- ✅ No TypeScript errors
- ✅ UI still functional
- ✅ Changes committed

---

## Next Steps (Day 4)

After completing Day 3 migrations:

1. **Merge WorkflowOrchestrator simulation** into UnifiedAgentOrchestrator
2. **Merge WorkflowOrchestrator guardrails** into UnifiedAgentOrchestrator
3. **Update WorkflowErrorPanel.tsx** to use unified orchestrator
4. **Update PlaygroundWorkflowAdapter.ts** to use unified orchestrator

---

**Last Updated:** 2025-12-13 05:10 UTC  
**Status:** Ready for execution  
**Owner:** Sprint 1 Team
