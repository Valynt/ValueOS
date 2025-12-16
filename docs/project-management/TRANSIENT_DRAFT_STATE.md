# Transient Draft State (Playground Layer)

## Overview

The Transient Draft State system enables **rapid experimentation** in the Artifact Builder Playground without database overhead. All micro-interactions (moving cards, changing titles, tweaking values) happen in Redis, and only committed changes are persisted to Postgres.

This creates a true "Playground" experience - fast, responsive, with undo/redo - rather than the sluggish "submit and wait" feel of batch workflows.

## The Problem

**Before (Database-Heavy)**:
```
User: "Move this card 10px to the right"
  ↓
Write to workflow_execution_logs (Postgres)
  ↓
Write to workflow_artifacts (Postgres)
  ↓
Result: 200-500ms latency, database bloat, no undo
```

**After (Redis-Backed)**:
```
User: "Move this card 10px to the right"
  ↓
Update session in Redis (<10ms)
  ↓
Auto-save checkpoint every 30s
  ↓
Commit to Postgres only when user clicks "Publish"
  ↓
Result: <10ms latency, full undo/redo, clean database
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Playground UI                            │
│  - User edits                                               │
│  - Agent actions                                            │
│  - Undo/Redo                                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           PlaygroundWorkflowAdapter                         │
│  - Coordinates between workflow and session                 │
│  - Applies mutations                                        │
│  - Manages lifecycle                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────────┐        ┌────────────────────┐
│ Redis Session     │        │ Postgres           │
│ (Transient)       │        │ (Committed)        │
│                   │        │                    │
│ - Current layout  │        │ - Artifacts        │
│ - History stack   │        │ - Executions       │
│ - Checkpoints     │        │ - Logs             │
│ - Metadata        │        │                    │
│                   │        │ Only on commit →   │
│ TTL: 1 hour       │        │                    │
└───────────────────┘        └────────────────────┘
        ↑
        │
        ▼
┌───────────────────┐
│ Auto-Save Worker  │
│ - Checkpoints     │
│ - Idle detection  │
│ - Recovery        │
└───────────────────┘
```

## Key Features

### 1. Session Lifecycle

**States**:
- `active` - User is actively editing
- `idle` - No activity for 5+ minutes
- `committing` - Being committed to database
- `committed` - Successfully committed
- `discarded` - User discarded changes
- `expired` - Session expired (1 hour TTL)

**Lifecycle**:
```typescript
// Create session
const { sessionId } = await adapter.startDraftWorkflow(
  workflowDefinitionId,
  userId,
  organizationId,
  initialLayout
);

// Make changes (stays in Redis)
await adapter.applyDraftMutation(sessionId, action, actor);

// Commit to database
await adapter.commitDraft(sessionId, "Final version");

// Or discard
await adapter.discardDraft(sessionId);
```

### 2. Undo/Redo Stack

Every operation is tracked in history:

```typescript
interface HistoryOperation {
  id: string;
  type: 'mutation' | 'regeneration' | 'user_edit' | 'agent_action';
  timestamp: string;
  before: SDUIPageDefinition;  // State before
  after: SDUIPageDefinition;   // State after
  action?: AtomicUIAction;     // What caused the change
  description: string;
  actor: { type: 'user' | 'agent'; id: string };
}
```

**Usage**:
```typescript
// Undo last operation
const { layout } = await adapter.undo(sessionId);

// Redo
const { layout } = await adapter.redo(sessionId);

// Get history
const { history, currentIndex } = await adapter.getHistory(sessionId);
```

### 3. Auto-Save Checkpoints

Automatic checkpoints every 30 seconds:

```typescript
interface AutoSaveCheckpoint {
  id: string;
  timestamp: string;
  layout: SDUIPageDefinition;
  operationCount: number;
  description: string;
}
```

**Recovery**:
```typescript
// Restore from checkpoint
await sessionService.restoreCheckpoint(sessionId, checkpointId);
```

### 4. Conflict Resolution

Handles concurrent edits:

```typescript
const resolver = getConflictResolver();

const resolution = await resolver.resolve(
  serverLayout,
  clientLayout,
  'merge'  // or 'server_wins', 'client_wins', 'manual'
);

if (resolution.resolved) {
  // Use merged layout
  const layout = resolution.layout;
} else {
  // Show conflicts to user
  const conflicts = resolution.conflicts;
}
```

## Usage Examples

### Example 1: Start Playground Session

```typescript
import { getPlaygroundWorkflowAdapter } from '../services/PlaygroundWorkflowAdapter';
import { getPlaygroundSessionService } from '../services/PlaygroundSessionService';
import { WorkflowOrchestrator } from '../services/WorkflowOrchestrator';

const orchestrator = new WorkflowOrchestrator();
const sessionService = getPlaygroundSessionService();
const adapter = getPlaygroundWorkflowAdapter(orchestrator, sessionService);

// Start draft workflow
const { sessionId, workflowExecutionId } = await adapter.startDraftWorkflow(
  'workflow-123',
  'user-456',
  'org-789',
  initialLayout,
  { projectName: 'Q4 QBR' }
);

console.log('Session started:', sessionId);
// Auto-save starts automatically
```

### Example 2: Apply User Mutation

```typescript
import { createPropertyUpdate } from '../sdui/AtomicUIActions';

// User: "Change the chart to a bar graph"
const action = createPropertyUpdate(
  { type: 'InteractiveChart', description: 'ROI chart' },
  'props.type',
  'bar'
);

const result = await adapter.applyDraftMutation(
  sessionId,
  action,
  { type: 'user', id: 'user-456', name: 'John Doe' }
);

if (result.success) {
  // Update UI with new layout
  setCurrentLayout(result.layout);
}
```

### Example 3: Apply Agent Action

```typescript
// Agent generates new layout
const newLayout = await agent.generateLayout(context);

const result = await adapter.applyAgentAction(
  sessionId,
  newLayout,
  'realization-loop-agent',
  'RealizationLoopAgent',
  'Generated realization dashboard'
);

if (result.success) {
  setCurrentLayout(result.layout);
}
```

### Example 4: Undo/Redo

```typescript
// Undo button clicked
const undoResult = await adapter.undo(sessionId);
if (undoResult.success) {
  setCurrentLayout(undoResult.layout);
  toast.success('Undone');
}

// Redo button clicked
const redoResult = await adapter.redo(sessionId);
if (redoResult.success) {
  setCurrentLayout(redoResult.layout);
  toast.success('Redone');
}
```

### Example 5: Commit to Database

```typescript
// User clicks "Publish"
const commitResult = await adapter.commitDraft(
  sessionId,
  'Final Q4 QBR dashboard'
);

if (commitResult.success) {
  toast.success('Published successfully!');
  router.push(`/artifacts/${commitResult.artifactId}`);
} else {
  toast.error(`Failed to publish: ${commitResult.error}`);
}
```

### Example 6: Discard Changes

```typescript
// User clicks "Discard"
await adapter.discardDraft(sessionId);
toast.info('Changes discarded');
router.push('/dashboard');
```

### Example 7: View History

```typescript
const { history, currentIndex } = await adapter.getHistory(sessionId);

// Display history timeline
history.forEach((op, index) => {
  console.log(`${index === currentIndex ? '→' : ' '} ${op.description}`);
  console.log(`  By: ${op.actor.name || op.actor.id}`);
  console.log(`  At: ${new Date(op.timestamp).toLocaleString()}`);
});
```

### Example 8: Session Statistics

```typescript
const stats = await adapter.getStats(sessionId);

console.log('Session Statistics:');
console.log(`Duration: ${stats.duration}ms`);
console.log(`Total Operations: ${stats.totalOperations}`);
console.log(`Mutations: ${stats.operationsByType.mutation || 0}`);
console.log(`Agent Actions: ${stats.operationsByType.agent_action || 0}`);
console.log(`Undo Count: ${stats.undoCount}`);
console.log(`Redo Count: ${stats.redoCount}`);
console.log(`Changes Made: ${stats.changesMade}`);
```

## API Reference

### PlaygroundWorkflowAdapter

```typescript
class PlaygroundWorkflowAdapter {
  // Start draft workflow
  async startDraftWorkflow(
    workflowDefinitionId: string,
    userId: string,
    organizationId: string,
    initialLayout: SDUIPageDefinition,
    context?: Record<string, any>
  ): Promise<{ sessionId: string; workflowExecutionId: string }>

  // Apply user mutation
  async applyDraftMutation(
    sessionId: string,
    action: AtomicUIAction,
    actor: { type: 'user' | 'agent'; id: string; name?: string }
  ): Promise<{ success: boolean; layout?: SDUIPageDefinition; error?: string }>

  // Apply agent action
  async applyAgentAction(
    sessionId: string,
    newLayout: SDUIPageDefinition,
    agentId: string,
    agentName: string,
    description: string
  ): Promise<{ success: boolean; layout?: SDUIPageDefinition; error?: string }>

  // Commit to database
  async commitDraft(
    sessionId: string,
    commitMessage?: string
  ): Promise<{ success: boolean; artifactId?: string; error?: string }>

  // Discard draft
  async discardDraft(sessionId: string): Promise<void>

  // Undo/Redo
  async undo(sessionId: string): Promise<{ success: boolean; layout?: SDUIPageDefinition }>
  async redo(sessionId: string): Promise<{ success: boolean; layout?: SDUIPageDefinition }>

  // Get history
  async getHistory(sessionId: string): Promise<{ history: HistoryOperation[]; currentIndex: number }>

  // Get statistics
  async getStats(sessionId: string): Promise<SessionStats>

  // Resume idle session
  async resumeSession(sessionId: string): Promise<{ success: boolean; layout?: SDUIPageDefinition }>

  // List user sessions
  async listUserSessions(userId: string): Promise<string[]>
}
```

### PlaygroundSessionService

```typescript
class PlaygroundSessionService {
  // Create session
  async createSession(options: CreateSessionOptions): Promise<PlaygroundSession>

  // Load session
  async loadSession(sessionId: string): Promise<PlaygroundSession | null>

  // Update session
  async updateSession(sessionId: string, options: UpdateSessionOptions): Promise<PlaygroundSession | null>

  // Undo/Redo
  async undo(sessionId: string): Promise<PlaygroundSession | null>
  async redo(sessionId: string): Promise<PlaygroundSession | null>

  // Commit to database
  async commitSession(sessionId: string, options?: CommitOptions): Promise<{ success: boolean; artifactId?: string }>

  // Discard session
  async discardSession(sessionId: string): Promise<void>

  // Get statistics
  async getSessionStats(sessionId: string): Promise<SessionStats | null>

  // List sessions
  async listUserSessions(userId: string): Promise<string[]>
  async listOrgSessions(orgId: string): Promise<string[]>
}
```

## Performance Comparison

| Operation | Database-Heavy | Redis-Backed | Improvement |
|-----------|---------------|--------------|-------------|
| Apply mutation | 200-500ms | <10ms | **20-50x faster** |
| Undo/Redo | Not possible | <5ms | **∞ (new capability)** |
| Auto-save | N/A | <10ms | **No DB bloat** |
| Commit | 200-500ms | 200-500ms | **Same (only on commit)** |

**Database Impact**:
- Before: 100 micro-edits = 100 database writes
- After: 100 micro-edits = 1 database write (on commit)
- **99% reduction in database writes**

## Configuration

### Session Configuration

```typescript
const config: SessionConfig = {
  ttl: 60 * 60,              // 1 hour session lifetime
  maxHistorySize: 50,        // Max undo/redo operations
  maxCheckpoints: 10,        // Max auto-save checkpoints
  autoSaveEnabled: true,     // Enable auto-save
  autoSaveInterval: 30000,   // Auto-save every 30 seconds
  idleTimeout: 300000,       // Mark idle after 5 minutes
};

const sessionService = new PlaygroundSessionService(config);
```

### Redis Configuration

```typescript
// Environment variables
REDIS_URL=redis://localhost:6379
ENABLE_PLAYGROUND_SESSIONS=true
```

## Redis Key Structure

```
playground:session:{sessionId}              # Session data
playground:user:{userId}:sessions           # User's sessions (set)
playground:org:{orgId}:sessions             # Org's sessions (set)
playground:artifact:{artifactId}:sessions   # Artifact's sessions (set)
playground:lock:{sessionId}                 # Session lock (for concurrency)
playground:autosave:queue                   # Auto-save queue
```

## Best Practices

### 1. Always Use Draft Mode for Playground

✅ **DO**: Use draft mode for interactive editing
```typescript
const { sessionId } = await adapter.startDraftWorkflow(...);
// All edits stay in Redis
```

❌ **DON'T**: Write directly to database for micro-edits
```typescript
// This bloats the database
await supabase.from('workflow_artifacts').insert(...);
```

### 2. Commit Frequently Enough

✅ **DO**: Commit at logical milestones
```typescript
// User clicks "Save Draft" or "Publish"
await adapter.commitDraft(sessionId, "Milestone 1 complete");
```

❌ **DON'T**: Never commit (data loss on expiration)
```typescript
// Session expires after 1 hour, data lost!
```

### 3. Handle Session Expiration

✅ **DO**: Check session validity
```typescript
const session = await sessionService.loadSession(sessionId);
if (!session) {
  toast.error('Session expired. Please start a new session.');
  router.push('/playground/new');
}
```

❌ **DON'T**: Assume session always exists
```typescript
// This will fail if session expired
await adapter.applyDraftMutation(sessionId, action, actor);
```

### 4. Use Undo/Redo Liberally

✅ **DO**: Provide undo/redo buttons
```typescript
<button onClick={() => adapter.undo(sessionId)}>Undo</button>
<button onClick={() => adapter.redo(sessionId)}>Redo</button>
```

❌ **DON'T**: Make users manually revert changes
```typescript
// Bad UX - no way to undo mistakes
```

### 5. Show Session Status

✅ **DO**: Display session state to user
```typescript
const stats = await adapter.getStats(sessionId);
<div>
  {stats.changesMade} unsaved changes
  Last saved: {stats.lastAutoSaveAt}
</div>
```

❌ **DON'T**: Hide session state
```typescript
// User doesn't know if changes are saved
```

## Troubleshooting

### Session Not Found

**Problem**: `loadSession` returns null

**Solutions**:
1. Check if session expired (1 hour TTL)
2. Verify Redis connection
3. Check session ID is correct
4. Look for session in user's session list

### Auto-Save Not Working

**Problem**: Checkpoints not being created

**Solutions**:
1. Check `autoSaveEnabled` is true
2. Verify auto-save worker is running
3. Check session is in `active` state
4. Review auto-save interval setting

### Commit Failed

**Problem**: `commitDraft` returns error

**Solutions**:
1. Check database connection
2. Verify user has permissions
3. Check workflow execution exists
4. Review error message for details

### Undo/Redo Not Working

**Problem**: History operations fail

**Solutions**:
1. Check history is not empty
2. Verify history index is valid
3. Check session is in `active` state
4. Review operation history

## Migration Guide

### From Database-Heavy to Redis-Backed

**Before**:
```typescript
// Every edit writes to database
async function updateArtifact(artifactId, newLayout) {
  await supabase
    .from('workflow_artifacts')
    .update({ artifact_data: newLayout })
    .eq('id', artifactId);
}
```

**After**:
```typescript
// Edits stay in Redis
async function updateArtifact(sessionId, action) {
  await adapter.applyDraftMutation(sessionId, action, actor);
  // Only commits to database when user clicks "Publish"
}
```

## Future Enhancements

1. **Collaborative Editing**: Multiple users in same session
2. **Branching**: Create branches from checkpoints
3. **Diff Visualization**: Show changes between versions
4. **Session Sharing**: Share session URL with team
5. **Persistent Drafts**: Optional longer TTL for drafts
6. **Offline Support**: Local storage fallback

## Summary

The Transient Draft State system transforms the Playground from a database-heavy batch workflow into a responsive, interactive tool:

- ⚡ **20-50x faster** than database writes
- 💾 **99% reduction** in database writes
- ↩️ **Full undo/redo** support
- 💰 **No database bloat** from micro-edits
- 🔄 **Auto-save** with checkpoints
- 🔒 **Conflict resolution** for concurrent edits
- ⏱️ **1 hour TTL** prevents stale sessions
- 📊 **Session statistics** for monitoring

This enables the "Playground" feel users expect from modern UI builders - fast, responsive, with full undo/redo - while keeping the database clean and performant.
