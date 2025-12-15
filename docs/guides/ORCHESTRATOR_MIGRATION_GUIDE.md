# Orchestrator Migration Guide

**Quick Reference for Developers**

---

## TL;DR

**Old Way (Deprecated):**
```typescript
import { agentOrchestrator } from './services/AgentOrchestrator'; // ❌ DON'T USE
const response = await agentOrchestrator.processQuery(query, context);
```

**New Way (Recommended):**
```typescript
import { agentOrchestrator } from './services/AgentOrchestratorAdapter'; // ✅ USE THIS
const response = await agentOrchestrator.processQuery(query, { userId, sessionId, context });
```

**Direct Access (Advanced):**
```typescript
import { getUnifiedOrchestrator } from './services/UnifiedAgentOrchestrator'; // ✅ ALSO GOOD
const orchestrator = getUnifiedOrchestrator();
const state = orchestrator.createInitialState('discovery', context);
const result = await orchestrator.processQuery(query, state, userId, sessionId);
```

---

## Migration Patterns

### Pattern 1: Simple Query Processing

**Before:**
```typescript
import { agentOrchestrator } from './services/AgentOrchestrator';

async function handleQuery(query: string) {
  const response = await agentOrchestrator.processQuery(query, {
    components: canvasComponents
  });
  return response;
}
```

**After:**
```typescript
import { agentOrchestrator } from './services/AgentOrchestratorAdapter';

async function handleQuery(query: string, userId: string, sessionId: string) {
  const response = await agentOrchestrator.processQuery(query, {
    userId,
    sessionId,
    context: { components: canvasComponents }
  });
  return response;
}
```

**Changes:**
- ✅ Import from `AgentOrchestratorAdapter` instead of `AgentOrchestrator`
- ✅ Add `userId` and `sessionId` parameters
- ✅ Wrap context in `context` property

---

### Pattern 2: Workflow Execution

**Before:**
```typescript
import { workflowOrchestrator } from './services/WorkflowOrchestrator';

async function executeWorkflow(workflowId: string, context: any) {
  const executionId = await workflowOrchestrator.executeWorkflow(
    workflowId,
    context
  );
  return executionId;
}
```

**After:**
```typescript
import { getUnifiedOrchestrator } from './services/UnifiedAgentOrchestrator';

async function executeWorkflow(
  workflowId: string,
  context: any,
  userId: string
) {
  const orchestrator = getUnifiedOrchestrator();
  const result = await orchestrator.executeWorkflow(
    workflowId,
    context,
    userId
  );
  return result.executionId; // Note: returns object, not just ID
}
```

**Changes:**
- ✅ Import from `UnifiedAgentOrchestrator`
- ✅ Add `userId` parameter
- ✅ Result is object with `executionId`, not just string

---

### Pattern 3: SDUI Generation

**Before:**
```typescript
import { agentOrchestrator } from './services/AgentOrchestrator';

async function generatePage(agent: string, query: string) {
  const response = await agentOrchestrator.generateSDUIPage(
    agent,
    query,
    { userId: 'user-123' }
  );
  return response.sduiPage;
}
```

**After:**
```typescript
import { agentOrchestrator } from './services/AgentOrchestratorAdapter';

async function generatePage(agent: string, query: string, userId: string) {
  const response = await agentOrchestrator.generateSDUIPage(
    agent,
    query,
    { userId, sessionId: 'session-123' }
  );
  return response.sduiPage;
}
```

**Changes:**
- ✅ Import from `AgentOrchestratorAdapter`
- ✅ Add `sessionId` to context
- ✅ Same method signature, just different import

---

### Pattern 4: Streaming Updates

**Before:**
```typescript
import { agentOrchestrator, StreamingUpdate } from './services/AgentOrchestrator';

agentOrchestrator.onStreaming((update: StreamingUpdate) => {
  console.log(update.stage, update.message);
});
```

**After:**
```typescript
import { agentOrchestrator, StreamingUpdate } from './services/AgentOrchestratorAdapter';

const unsubscribe = agentOrchestrator.onStreaming((update: StreamingUpdate) => {
  console.log(update.stage, update.message);
});

// Later: cleanup
unsubscribe();
```

**Changes:**
- ✅ Import from `AgentOrchestratorAdapter`
- ✅ `onStreaming` now returns unsubscribe function
- ✅ Same `StreamingUpdate` type

---

### Pattern 5: Workflow State Management

**Before:**
```typescript
import { agentOrchestrator } from './services/AgentOrchestrator';

agentOrchestrator.initializeWorkflow('discovery', { userId: 'user-123' });
const state = agentOrchestrator.getWorkflowState();
agentOrchestrator.updateWorkflowStage('analysis', 'in_progress');
```

**After (via Adapter):**
```typescript
import { agentOrchestrator } from './services/AgentOrchestratorAdapter';

agentOrchestrator.initializeWorkflow('discovery', { userId: 'user-123' });
const state = agentOrchestrator.getCurrentState();
agentOrchestrator.updateStage('analysis', 'in_progress');
```

**After (via Unified - Recommended):**
```typescript
import { getUnifiedOrchestrator } from './services/UnifiedAgentOrchestrator';

const orchestrator = getUnifiedOrchestrator();
let state = orchestrator.createInitialState('discovery', { userId: 'user-123' });

// Process query and get new state
const result = await orchestrator.processQuery(query, state, userId, sessionId);
state = result.nextState;

// Update stage
state = orchestrator.updateStage(state, 'analysis', 'in_progress');
```

**Changes:**
- ✅ State is immutable, passed as parameter
- ✅ Methods return new state instead of mutating
- ✅ Safer for concurrent requests

---

## Common Pitfalls

### Pitfall 1: Forgetting userId/sessionId

**Wrong:**
```typescript
const response = await agentOrchestrator.processQuery(query, context);
// ❌ Missing userId and sessionId
```

**Right:**
```typescript
const response = await agentOrchestrator.processQuery(query, {
  userId: currentUser.id,
  sessionId: currentSession.id,
  context
});
// ✅ Includes required parameters
```

---

### Pitfall 2: Expecting String Instead of Object

**Wrong:**
```typescript
const executionId = await orchestrator.executeWorkflow(workflowId, context, userId);
console.log(executionId); // ❌ This is an object, not a string!
```

**Right:**
```typescript
const result = await orchestrator.executeWorkflow(workflowId, context, userId);
console.log(result.executionId); // ✅ Access executionId property
console.log(result.status);      // ✅ Also has status, currentStage, etc.
```

---

### Pitfall 3: Mutating State

**Wrong:**
```typescript
const state = orchestrator.createInitialState('discovery', context);
state.currentStage = 'analysis'; // ❌ Don't mutate state directly!
```

**Right:**
```typescript
let state = orchestrator.createInitialState('discovery', context);
state = orchestrator.updateStage(state, 'analysis', 'in_progress');
// ✅ Get new state from method
```

---

### Pitfall 4: Using Deprecated Imports

**Wrong:**
```typescript
import { agentOrchestrator } from './services/AgentOrchestrator';
// ❌ This is deprecated!
```

**Right:**
```typescript
import { agentOrchestrator } from './services/AgentOrchestratorAdapter';
// ✅ Use adapter for backward compatibility

// OR

import { getUnifiedOrchestrator } from './services/UnifiedAgentOrchestrator';
// ✅ Use unified directly for new code
```

---

## Type Changes

### Old Types (Deprecated)

```typescript
// From AgentOrchestrator
interface AgentResponse {
  type: 'component' | 'message' | 'suggestion' | 'sdui-page';
  payload: any;
  streaming?: boolean;
  sduiPage?: SDUIPageDefinition;
}

interface StreamingUpdate {
  stage: 'analyzing' | 'processing' | 'generating' | 'complete';
  message: string;
  progress?: number;
}
```

### New Types (Current)

```typescript
// From UnifiedAgentOrchestrator (same types, different import)
import { AgentResponse, StreamingUpdate } from './services/UnifiedAgentOrchestrator';

// OR from adapter (re-exports from unified)
import { AgentResponse, StreamingUpdate } from './services/AgentOrchestratorAdapter';

// New types for workflow execution
interface WorkflowExecutionResult {
  executionId: string;
  status: WorkflowStatus;
  currentStage: string | null;
  completedStages: string[];
  error?: string;
}

interface ProcessQueryResult {
  response: AgentResponse | null;
  nextState: WorkflowState;
  traceId: string;
}
```

---

## Testing Changes

### Old Test Pattern

```typescript
import { agentOrchestrator } from './services/AgentOrchestrator';

describe('Query Processing', () => {
  it('should process query', async () => {
    const response = await agentOrchestrator.processQuery('test query', {});
    expect(response).toBeDefined();
  });
});
```

### New Test Pattern

```typescript
import { getUnifiedOrchestrator } from './services/UnifiedAgentOrchestrator';

describe('Query Processing', () => {
  it('should process query', async () => {
    const orchestrator = getUnifiedOrchestrator();
    const state = orchestrator.createInitialState('discovery', {});
    
    const result = await orchestrator.processQuery(
      'test query',
      state,
      'test-user',
      'test-session',
      'test-trace'
    );
    
    expect(result.response).toBeDefined();
    expect(result.nextState).toBeDefined();
    expect(result.traceId).toBe('test-trace');
  });
});
```

---

## Feature Flag Control

### Enable/Disable Unified Orchestration

```bash
# .env or .env.local
VITE_ENABLE_UNIFIED_ORCHESTRATION=true  # Use unified (default)
VITE_ENABLE_UNIFIED_ORCHESTRATION=false # Fallback to legacy (emergency only)
```

### Check Feature Flag in Code

```typescript
import { featureFlags } from './config/featureFlags';

if (featureFlags.ENABLE_UNIFIED_ORCHESTRATION) {
  // Use unified orchestrator
  const orchestrator = getUnifiedOrchestrator();
} else {
  // Fallback to legacy (should not happen in production)
  console.warn('Using legacy orchestrator - this is deprecated!');
}
```

---

## Rollback Plan

If you encounter issues with the unified orchestrator:

1. **Disable feature flag:**
   ```bash
   VITE_ENABLE_UNIFIED_ORCHESTRATION=false
   ```

2. **Restart application:**
   ```bash
   npm run dev
   ```

3. **Report issue:**
   - Create GitHub issue with error details
   - Include trace ID from logs
   - Describe expected vs actual behavior

4. **Temporary workaround:**
   ```typescript
   // In emergency, import legacy directly (NOT RECOMMENDED)
   import { agentOrchestrator } from './services/AgentOrchestrator';
   // But this is deprecated and will be removed!
   ```

---

## Quick Reference Table

| Task | Old Import | New Import | Notes |
|------|-----------|-----------|-------|
| Query Processing | `AgentOrchestrator` | `AgentOrchestratorAdapter` | Use adapter for compatibility |
| Workflow Execution | `WorkflowOrchestrator` | `UnifiedAgentOrchestrator` | Returns object, not string |
| SDUI Generation | `AgentOrchestrator` | `AgentOrchestratorAdapter` | Same interface |
| Task Planning | N/A | `UnifiedAgentOrchestrator` | New feature |
| Streaming Updates | `AgentOrchestrator` | `AgentOrchestratorAdapter` | Returns unsubscribe function |
| State Management | `AgentOrchestrator` | `UnifiedAgentOrchestrator` | Stateless, pass state as param |

---

## Need Help?

- **Documentation:** See `ORCHESTRATOR_CONSOLIDATION_ANALYSIS.md`
- **Architecture:** See `docs/architecture/orchestrator-consolidation-diagram.md`
- **Tests:** See `src/services/__tests__/UnifiedAgentOrchestrator.test.ts`
- **Issues:** Create GitHub issue with `orchestrator` label

---

**Last Updated:** 2024-12-13  
**Status:** Active  
**Maintainer:** Engineering Team
