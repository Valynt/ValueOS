# Realtime Collaboration Architecture

## Overview

ValueOS implements real-time collaborative editing using Supabase Realtime infrastructure. This enables multiple users to work simultaneously on business cases with live updates, presence awareness, and conflict resolution.

## Architecture Components

### 1. Supabase Realtime

**Technology**: PostgreSQL + Supabase Realtime (built on Phoenix Channels)

**Features**:
- Real-time database changes via PostgreSQL replication
- Presence tracking for active users
- Broadcast channels for custom events
- Automatic reconnection and error handling

### 2. Database Tables

#### canvas_elements
Stores collaborative canvas elements (shapes, text, connectors, etc.)

```sql
CREATE TABLE canvas_elements (
  id UUID PRIMARY KEY,
  value_case_id UUID REFERENCES value_cases(id),
  element_type TEXT CHECK (element_type IN ('text', 'shape', 'connector', 'sticky_note', 'image')),
  position_x NUMERIC,
  position_y NUMERIC,
  width NUMERIC,
  height NUMERIC,
  content JSONB,
  style JSONB,
  z_index INTEGER,
  locked BOOLEAN,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### canvas_presence
Tracks active users on the canvas

```sql
CREATE TABLE canvas_presence (
  id UUID PRIMARY KEY,
  value_case_id UUID REFERENCES value_cases(id),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  user_email TEXT,
  cursor_x NUMERIC,
  cursor_y NUMERIC,
  selected_element_id UUID,
  status TEXT CHECK (status IN ('active', 'idle', 'away')),
  last_seen TIMESTAMPTZ,
  UNIQUE(value_case_id, user_id)
);
```

#### canvas_comments
Stores comments and discussions

```sql
CREATE TABLE canvas_comments (
  id UUID PRIMARY KEY,
  value_case_id UUID REFERENCES value_cases(id),
  element_id UUID REFERENCES canvas_elements(id),
  parent_comment_id UUID REFERENCES canvas_comments(id),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  content TEXT,
  resolved BOOLEAN,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### 3. Realtime Service

**File**: `src/lib/realtime/supabaseRealtime.ts`

**Responsibilities**:
- Manage Supabase Realtime channels
- Subscribe to database changes
- Handle presence tracking
- Broadcast custom events
- Manage reconnection logic

**Key Methods**:
```typescript
class SupabaseRealtimeService {
  subscribeToElements(valueCaseId, callback): unsubscribe
  subscribeToComments(valueCaseId, callback): unsubscribe
  subscribeToPresence(valueCaseId, currentUser, callback): unsubscribe
  updatePresence(valueCaseId, updates): Promise<void>
  broadcast(valueCaseId, event): Promise<void>
  subscribeToBroadcast(valueCaseId, callback): unsubscribe
}
```

### 4. Connection Manager

**File**: `src/lib/realtime/connectionManager.ts`

**Responsibilities**:
- Track connection state
- Handle reconnection with exponential backoff
- Categorize and report errors
- Notify state change listeners

**Connection States**:
- `DISCONNECTED`: No active connection
- `CONNECTING`: Establishing connection
- `CONNECTED`: Active and healthy
- `RECONNECTING`: Attempting to reconnect
- `ERROR`: Connection failed

**Reconnection Strategy**:
```typescript
{
  maxAttempts: 5,
  initialDelay: 1000,      // 1 second
  maxDelay: 30000,         // 30 seconds
  backoffMultiplier: 2     // Exponential backoff
}
```

## Data Flow

### 1. Element Creation

```
User A creates element
    ↓
Local state updated (optimistic)
    ↓
INSERT to canvas_elements table
    ↓
PostgreSQL triggers replication
    ↓
Supabase Realtime broadcasts change
    ↓
User B receives INSERT event
    ↓
User B's local state updated
```

### 2. Presence Updates

```
User A moves cursor
    ↓
updatePresence() called
    ↓
Presence channel tracks update
    ↓
Broadcast to all subscribers
    ↓
User B receives presence update
    ↓
User B's UI shows User A's cursor
```

### 3. Comment Thread

```
User A adds comment
    ↓
INSERT to canvas_comments table
    ↓
Realtime broadcasts to subscribers
    ↓
User B receives comment
    ↓
User B's UI shows new comment
    ↓
User B replies (parent_comment_id set)
    ↓
Thread structure maintained
```

## Conflict Resolution

### Optimistic Updates

All changes are applied locally immediately for responsiveness, then synchronized with the server.

```typescript
// 1. Apply change locally
updateLocalState(element);

// 2. Send to server
await updateElement(element);

// 3. If server rejects, revert local change
if (error) {
  revertLocalState(element);
}
```

### Last-Write-Wins (LWW)

For simple conflicts, the last update wins based on `updated_at` timestamp.

```typescript
if (incomingElement.updated_at > localElement.updated_at) {
  // Accept incoming change
  updateLocalState(incomingElement);
} else {
  // Keep local change
  ignoreIncomingChange();
}
```

### Operational Transformation (OT)

For text editing, we use operational transformation to merge concurrent edits.

```typescript
// User A types "Hello"
// User B types "World" at same position
// OT merges to "HelloWorld" or "WorldHello" based on timestamps
```

### Locking

Elements can be locked to prevent concurrent edits.

```typescript
// User A locks element
await lockElement(elementId);

// User B tries to edit
if (element.locked && element.locked_by !== currentUserId) {
  showError("Element is locked by another user");
  return;
}
```

## Presence System

### User States

- **Active**: Currently editing or viewing
- **Idle**: No activity for 2 minutes
- **Away**: No activity for 5 minutes

### Presence Data

```typescript
interface PresenceUser {
  userId: string;
  userName: string;
  userEmail: string;
  cursorX?: number;
  cursorY?: number;
  selectedElementId?: string;
  status: 'active' | 'idle' | 'away';
  lastSeen: string;
}
```

### Presence Cleanup

Stale presence records (>5 minutes) are automatically cleaned up:

```sql
DELETE FROM canvas_presence
WHERE last_seen < now() - INTERVAL '5 minutes';
```

## Performance Optimization

### 1. Throttling

Cursor movements and frequent updates are throttled to reduce network traffic:

```typescript
const throttledUpdatePresence = throttle(updatePresence, 100); // 100ms
```

### 2. Batching

Multiple changes can be batched into a single database transaction:

```typescript
await supabase.rpc('batch_update_elements', {
  elements: [element1, element2, element3]
});
```

### 3. Selective Subscriptions

Only subscribe to changes for the current value case:

```typescript
filter: `value_case_id=eq.${valueCaseId}`
```

### 4. Debouncing

Text input is debounced before sending updates:

```typescript
const debouncedUpdateContent = debounce(updateContent, 500); // 500ms
```

## Security

### Row-Level Security (RLS)

All tables have RLS policies to ensure users can only access their organization's data:

```sql
CREATE POLICY "Users can view canvas elements for their value cases"
  ON canvas_elements FOR SELECT
  USING (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );
```

### Authentication

All Realtime connections require valid JWT tokens:

```typescript
const channel = supabase.channel('canvas:vc-123', {
  config: {
    broadcast: { self: true },
    presence: { key: 'user_id' },
  },
});
```

### Rate Limiting

Supabase Realtime has built-in rate limiting:
- 100 messages per second per connection
- 10 MB per message
- 1000 concurrent connections per project

## Error Handling

### Connection Errors

```typescript
channel.subscribe((status) => {
  if (status === 'CHANNEL_ERROR') {
    connectionManager.handleError({
      type: ConnectionErrorType.SUBSCRIPTION_ERROR,
      message: 'Failed to subscribe to channel',
      retryable: true,
    });
  }
});
```

### Reconnection

Automatic reconnection with exponential backoff:

```
Attempt 1: 1 second delay
Attempt 2: 2 seconds delay
Attempt 3: 4 seconds delay
Attempt 4: 8 seconds delay
Attempt 5: 16 seconds delay
Max: 30 seconds delay
```

### Error Recovery

```typescript
try {
  await updateElement(element);
} catch (error) {
  // Revert optimistic update
  revertLocalState(element);
  
  // Show error to user
  showError('Failed to save changes');
  
  // Log error
  captureError(error, {
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.API,
  });
}
```

## Monitoring

### Metrics

- **Connection State**: Track connection health
- **Reconnection Rate**: Monitor reconnection frequency
- **Message Latency**: Measure real-time update delay
- **Presence Count**: Track active users
- **Error Rate**: Monitor error frequency

### Logging

```typescript
logger.info('Realtime event', {
  type: 'element_updated',
  valueCaseId: 'vc-123',
  elementId: 'elem-456',
  userId: 'user-789',
  latency: 45, // ms
});
```

### Alerts

- Connection failures > 5% of attempts
- Average latency > 1 second
- Reconnection rate > 10 per minute
- Error rate > 1% of operations

## Best Practices

### 1. Always Unsubscribe

```typescript
useEffect(() => {
  const unsubscribe = realtimeService.subscribeToElements(
    valueCaseId,
    handleElementChange
  );

  return () => {
    unsubscribe();
  };
}, [valueCaseId]);
```

### 2. Handle Offline Mode

```typescript
if (!navigator.onLine) {
  // Queue changes locally
  queueChange(element);
  
  // Sync when back online
  window.addEventListener('online', syncQueuedChanges);
}
```

### 3. Validate Data

```typescript
function handleElementChange(element: CanvasElement) {
  // Validate before applying
  if (!isValidElement(element)) {
    logger.warn('Invalid element received', { element });
    return;
  }
  
  updateLocalState(element);
}
```

### 4. Throttle High-Frequency Updates

```typescript
const throttledCursorUpdate = throttle((x, y) => {
  realtimeService.updatePresence(valueCaseId, {
    cursorX: x,
    cursorY: y,
  });
}, 100);
```

### 5. Use Optimistic Updates

```typescript
// Update UI immediately
setElements([...elements, newElement]);

// Then sync with server
try {
  await createElement(newElement);
} catch (error) {
  // Revert on error
  setElements(elements.filter(e => e.id !== newElement.id));
}
```

## Testing

### Unit Tests

```typescript
describe('SupabaseRealtimeService', () => {
  it('should subscribe to elements', () => {
    const callback = vi.fn();
    const unsubscribe = realtimeService.subscribeToElements('vc-123', callback);
    
    expect(mockChannel.subscribe).toHaveBeenCalled();
    expect(typeof unsubscribe).toBe('function');
  });
});
```

### Integration Tests

```typescript
describe('Realtime Collaboration', () => {
  it('should sync element changes between users', async () => {
    // User A creates element
    const element = await userA.createElement({ type: 'text' });
    
    // Wait for realtime sync
    await waitFor(() => {
      expect(userB.getElements()).toContainEqual(element);
    });
  });
});
```

### Load Tests

```typescript
// Simulate 100 concurrent users
for (let i = 0; i < 100; i++) {
  const user = createUser();
  await user.joinCanvas(valueCaseId);
  
  // Each user makes 10 updates per second
  setInterval(() => {
    user.updateElement(randomElement());
  }, 100);
}
```

## Troubleshooting

### Connection Issues

**Symptom**: Users not seeing real-time updates

**Solutions**:
1. Check network connectivity
2. Verify Supabase project status
3. Check browser console for errors
4. Verify JWT token is valid
5. Check RLS policies

### High Latency

**Symptom**: Slow real-time updates

**Solutions**:
1. Check network latency
2. Reduce update frequency (throttle/debounce)
3. Optimize database queries
4. Use database indexes
5. Consider regional deployment

### Presence Not Updating

**Symptom**: User cursors not showing

**Solutions**:
1. Verify presence channel subscription
2. Check presence cleanup job
3. Verify presence updates are being sent
4. Check for JavaScript errors
5. Verify RLS policies on canvas_presence

## Future Enhancements

### 1. Conflict-Free Replicated Data Types (CRDTs)

Replace LWW with CRDTs for better conflict resolution:

```typescript
import { Y } from 'yjs';

const ydoc = new Y.Doc();
const ymap = ydoc.getMap('canvas');

// Automatic conflict resolution
ymap.set('element-1', { x: 100, y: 200 });
```

### 2. Undo/Redo Stack

Implement collaborative undo/redo:

```typescript
const undoManager = new Y.UndoManager(ymap);
undoManager.undo();
undoManager.redo();
```

### 3. Version History

Track all changes for audit and rollback:

```typescript
CREATE TABLE canvas_element_history (
  id UUID PRIMARY KEY,
  element_id UUID REFERENCES canvas_elements(id),
  version INTEGER,
  changes JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ
);
```

### 4. Offline Support

Full offline editing with sync on reconnect:

```typescript
// Use IndexedDB for offline storage
const db = await openDB('valueos-offline', 1);
await db.put('elements', element);

// Sync when online
if (navigator.onLine) {
  await syncOfflineChanges();
}
```

## References

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [PostgreSQL Logical Replication](https://www.postgresql.org/docs/current/logical-replication.html)
- [Phoenix Channels](https://hexdocs.pm/phoenix/channels.html)
- [Operational Transformation](https://en.wikipedia.org/wiki/Operational_transformation)
- [CRDTs](https://crdt.tech/)
