# State Management Guide

## Overview

ValueCanvas implements a comprehensive state management system for SDUI components and workflow orchestration with:

- **SDUIStateManager**: Centralized state cache with subscriber pattern
- **WorkflowLifecycleIntegration**: Saga pattern for workflow orchestration
- **Compensation Handlers**: Automatic rollback on failure

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   SDUI   │  │Workflows │  │  Agents  │  │   API    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
└───────┼─────────────┼──────────────┼─────────────┼──────────┘
        │             │              │             │
┌───────┼─────────────┼──────────────┼─────────────┼──────────┐
│       │             │              │             │          │
│  ┌────▼─────────────▼──────────────▼─────────────▼────┐    │
│  │           SDUIStateManager                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │    │
│  │  │  Cache   │  │Subscribe │  │ Persist  │        │    │
│  │  └──────────┘  └──────────┘  └──────────┘        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      WorkflowLifecycleIntegration                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │  │
│  │  │  Saga    │  │Compensate│  │  Resume  │          │  │
│  │  └──────────┘  └──────────┘  └──────────┘          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Database (Supabase)                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │  │
│  │  │sdui_state│  │workflows │  │ sessions │          │  │
│  │  └──────────┘  └──────────┘  └──────────┘          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## SDUI State Management

### SDUIStateManager

Centralized state management for SDUI components with caching, subscriptions, and persistence.

#### Features

- **In-memory cache** for fast access
- **Subscriber pattern** for reactive updates
- **Database persistence** with debouncing
- **Optimistic updates** with conflict resolution
- **Version tracking** for state changes
- **Cache size limits** with LRU eviction

#### Basic Usage

```typescript
import { getSDUIStateManager } from './lib/state';

const stateManager = getSDUIStateManager({
  supabase,
  persistence: {
    enabled: true,
    sessionId: 'session-123'
  },
  debug: true
});

// Set state
stateManager.set('user', { name: 'John', age: 30 });

// Get state
const user = stateManager.get('user');

// Subscribe to changes
const unsubscribe = stateManager.subscribe('user', (event) => {
  console.log('User changed:', event.newValue);
});

// Update partial state
stateManager.update('user', { age: 31 });

// Delete state
stateManager.delete('user');
```

#### React Hooks

```typescript
import { useSDUIState, useOptimisticSDUIState } from './lib/state';

function MyComponent() {
  // Basic state hook
  const [user, setUser, loading] = useSDUIState('user', { name: '', age: 0 });

  // Optimistic updates
  const [data, updateData, isPending, error] = useOptimisticSDUIState('data');

  return (
    <div>
      {loading ? 'Loading...' : user?.name}
      <button onClick={() => setUser({ name: 'Jane', age: 25 })}>
        Update
      </button>
    </div>
  );
}
```

#### Provider Setup

```typescript
import { SDUIStateProvider } from './lib/state/SDUIStateProvider';

function App() {
  return (
    <SDUIStateProvider
      supabase={supabase}
      sessionId="session-123"
      persistence={true}
      debug={false}
    >
      <YourApp />
    </SDUIStateProvider>
  );
}
```

### State Synchronization

State is automatically synchronized across components:

```typescript
// Component A
function ComponentA() {
  const [count, setCount] = useSDUIState('counter', 0);
  
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}

// Component B - automatically updates when Component A changes state
function ComponentB() {
  const [count] = useSDUIState('counter', 0);
  
  return <div>Current count: {count}</div>;
}
```

### Persistence

State is automatically persisted to the database with debouncing:

```typescript
const stateManager = getSDUIStateManager({
  supabase,
  persistence: {
    enabled: true,
    debounceMs: 1000,  // Wait 1 second before persisting
    tableName: 'sdui_state',
    sessionId: 'session-123'
  }
});

// Set state - will be persisted after 1 second
stateManager.set('data', { value: 42 });

// Force immediate persistence
await stateManager.flush();
```

### Database Schema

```sql
CREATE TABLE sdui_state (
  key TEXT NOT NULL,
  session_id TEXT NOT NULL,
  value JSONB NOT NULL,
  version INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key, session_id)
);

CREATE INDEX idx_sdui_state_session ON sdui_state(session_id);
CREATE INDEX idx_sdui_state_updated ON sdui_state(updated_at DESC);
```

## Workflow State Management

### WorkflowLifecycleIntegration

Orchestrates multi-agent workflows with saga pattern and compensation.

#### Features

- **Saga pattern** for distributed transactions
- **Automatic compensation** on failure
- **Resume capability** from last successful stage
- **Stage sequencing** with dependencies
- **State persistence** in database

#### Basic Usage

```typescript
import { getWorkflowLifecycleIntegration } from './services/WorkflowLifecycleIntegration';

const integration = getWorkflowLifecycleIntegration(supabase);

// Execute complete workflow
const execution = await integration.executeWorkflow(
  'user-123',
  { companyName: 'Acme Corp' },
  {
    autoCompensate: true,
    sessionId: 'session-123'
  }
);

console.log('Status:', execution.status);
console.log('Completed stages:', execution.completedStages);
```

#### Partial Execution

```typescript
// Execute only specific stages
const execution = await integration.executeWorkflow(
  'user-123',
  { opportunityId: 'opp-1' },
  {
    startStage: 'target',
    stopStage: 'expansion'
  }
);
```

#### Resume Failed Workflow

```typescript
// Resume from last successful stage
const execution = await integration.resumeWorkflow(
  'exec-123',
  { additionalData: 'value' }
);
```

#### Manual Compensation

```typescript
// Manually trigger compensation
await integration.compensateWorkflow('exec-123');
```

### Lifecycle Stages

The workflow executes through five stages in sequence:

1. **Opportunity**: Discover and analyze opportunities
2. **Target**: Create value trees and ROI models
3. **Expansion**: Expand value trees with additional nodes
4. **Integrity**: Validate and approve value propositions
5. **Realization**: Track KPI measurements and outcomes

### Compensation Handlers

Each stage has a specific compensation handler:

```typescript
import { getLifecycleCompensationHandlers } from './services/LifecycleCompensationHandlers';

const handlers = getLifecycleCompensationHandlers(supabase);

// Get handler for a stage
const handler = handlers.getHandler('target');

// Execute compensation
await handler({
  stageId: 'stage-1',
  stage: 'target',
  artifactsCreated: ['tree-1', 'roi-1'],
  stateChanges: { valueTreeIds: ['tree-1'] },
  executionId: 'exec-1'
});
```

#### Compensation Logic

**Opportunity Stage:**
- Delete created opportunities
- Remove discovery artifacts
- Clear cached analysis

**Target Stage:**
- Delete value trees
- Remove ROI models
- Delete value commits
- Clear KPI targets

**Expansion Stage:**
- Revert value tree expansions
- Delete expansion nodes
- Remove expansion links
- Clear expansion cache

**Integrity Stage:**
- Remove integrity checks
- Delete validation results
- Clear integrity flags
- Revert approval status

**Realization Stage:**
- Delete realization records
- Remove KPI measurements
- Clear realization dashboard
- Revert feedback loops

### Workflow State Repository

Manages workflow state persistence:

```typescript
import { WorkflowStateRepository } from './repositories/WorkflowStateRepository';

const repository = new WorkflowStateRepository(supabase);

// Create session
const sessionId = await repository.createSession('user-123', {
  currentStage: 'opportunity',
  status: 'active',
  completedStages: [],
  context: {}
});

// Get state
const state = await repository.getState(sessionId);

// Save state
await repository.saveState(sessionId, {
  currentStage: 'target',
  status: 'active',
  completedStages: ['opportunity'],
  context: { results: {} }
});

// Atomic update with optimistic locking
const success = await repository.atomicStateUpdate(
  sessionId,
  expectedUpdatedAt,
  newState
);
```

## Best Practices

### 1. State Keys

Use consistent naming conventions:

```typescript
// Good
stateManager.set('user.profile', data);
stateManager.set('workflow.current_stage', stage);
stateManager.set('sdui.value_tree.nodes', nodes);

// Bad
stateManager.set('data', data);
stateManager.set('x', value);
```

### 2. Subscriptions

Always unsubscribe when component unmounts:

```typescript
useEffect(() => {
  const unsubscribe = stateManager.subscribe('key', callback);
  return unsubscribe; // Cleanup
}, []);
```

### 3. Optimistic Updates

Use optimistic updates for better UX:

```typescript
const [data, updateData, isPending, error] = useOptimisticSDUIState('data');

// Updates immediately in UI, persists in background
await updateData({ value: 42 });

if (error) {
  // Handle error, state is automatically reverted
  console.error('Update failed:', error);
}
```

### 4. Workflow Error Handling

Always enable auto-compensation:

```typescript
const execution = await integration.executeWorkflow(
  userId,
  input,
  {
    autoCompensate: true  // Automatically rollback on failure
  }
);
```

### 5. State Cleanup

Clean up state when no longer needed:

```typescript
// Delete specific state
stateManager.delete('temporary.data');

// Clear all state
stateManager.clear();

// Clean up old workflow executions
integration.cleanupExecutions(24 * 60 * 60 * 1000); // 24 hours
```

### 6. Performance

Optimize for performance:

```typescript
// Use debouncing for frequent updates
const stateManager = getSDUIStateManager({
  persistence: {
    enabled: true,
    debounceMs: 1000  // Batch updates
  },
  maxCacheSize: 1000  // Limit memory usage
});

// Batch multiple updates
stateManager.set('key1', value1, { persist: false });
stateManager.set('key2', value2, { persist: false });
stateManager.set('key3', value3);  // Only this persists
```

## Testing

### Unit Tests

```typescript
import { SDUIStateManager } from './lib/state/SDUIStateManager';

describe('SDUIStateManager', () => {
  let stateManager: SDUIStateManager;

  beforeEach(() => {
    stateManager = new SDUIStateManager({ debug: false });
  });

  it('should set and get state', () => {
    stateManager.set('test', { value: 42 });
    const result = stateManager.get('test');
    expect(result).toEqual({ value: 42 });
  });

  it('should notify subscribers', () => {
    const callback = vi.fn();
    stateManager.subscribe('test', callback);
    stateManager.set('test', 'value');
    expect(callback).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
import { WorkflowLifecycleIntegration } from './services/WorkflowLifecycleIntegration';

describe('Workflow Integration', () => {
  it('should execute workflow with compensation', async () => {
    const integration = new WorkflowLifecycleIntegration(supabase);
    
    const execution = await integration.executeWorkflow(
      'user-1',
      { companyName: 'Test' },
      { stopStage: 'opportunity' }
    );

    expect(execution.status).toBe('completed');
  });
});
```

## Troubleshooting

### State Not Persisting

1. **Check persistence is enabled:**
   ```typescript
   const config = stateManager.getMetadata('key');
   console.log('Dirty:', config?.dirty);
   ```

2. **Force flush:**
   ```typescript
   await stateManager.flush();
   ```

3. **Check database connection:**
   ```typescript
   const { data, error } = await supabase
     .from('sdui_state')
     .select('*')
     .limit(1);
   ```

### Workflow Compensation Failing

1. **Check compensation handlers:**
   ```typescript
   const handler = handlers.getHandler('target');
   console.log('Handler exists:', handler !== null);
   ```

2. **Review compensation logs:**
   ```typescript
   // Check logs for compensation errors
   logger.info('Compensation status', { executionId });
   ```

3. **Verify database permissions:**
   ```sql
   -- Check RLS policies allow deletion
   SELECT * FROM value_trees WHERE id = 'tree-1';
   ```

### State Synchronization Issues

1. **Verify subscriptions:**
   ```typescript
   const keys = stateManager.keys();
   console.log('Active keys:', keys);
   ```

2. **Check for memory leaks:**
   ```typescript
   console.log('Cache size:', stateManager.size());
   ```

3. **Monitor version conflicts:**
   ```typescript
   const metadata = stateManager.getMetadata('key');
   console.log('Version:', metadata?.version);
   ```

## Migration Guide

### From Local State to SDUIStateManager

**Before:**
```typescript
function Component() {
  const [data, setData] = useState(initialData);
  
  return <div>{data.value}</div>;
}
```

**After:**
```typescript
function Component() {
  const [data, setData] = useSDUIState('component.data', initialData);
  
  return <div>{data?.value}</div>;
}
```

### From Manual Workflow to Saga Pattern

**Before:**
```typescript
async function executeWorkflow(input) {
  const opp = await createOpportunity(input);
  const tree = await createValueTree(opp);
  const roi = await createROI(tree);
  return roi;
}
```

**After:**
```typescript
async function executeWorkflow(input) {
  const integration = getWorkflowLifecycleIntegration(supabase);
  
  const execution = await integration.executeWorkflow(
    userId,
    input,
    { autoCompensate: true }
  );
  
  return execution.results;
}
```

## Resources

- [SDUIStateManager API](../src/lib/state/SDUIStateManager.ts)
- [React Hooks](../src/lib/state/useSDUIState.ts)
- [Workflow Integration](../src/services/WorkflowLifecycleIntegration.ts)
- [Compensation Handlers](../src/services/LifecycleCompensationHandlers.ts)
- [Test Examples](../src/test/state/)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review test examples
3. Consult the API documentation
4. Open an issue in the repository
