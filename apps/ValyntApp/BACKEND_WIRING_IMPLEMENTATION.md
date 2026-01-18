# Backend Wiring Implementation

## Overview

This document describes the implementation of the backend wiring plan to connect the `CaseWorkspace` frontend to the `UnifiedAgentOrchestrator` backend.

## Implementation Summary

### 1. Created AgentOrchestratorAdapter

**File**: `apps/ValyntApp/src/services/AgentOrchestratorAdapter.ts`

A new service class that provides a unified interface to the backend `UnifiedAgentOrchestrator`:

- **Key Features**:
  - Async job execution via backend API endpoints
  - Polling for job results with configurable intervals
  - Progress updates during processing
  - Cancellation support via AbortController
  - Error handling and event emission
  - Singleton pattern for consistent instance management

- **Methods**:
  - `invokeAgent()`: Sends a query to the backend and polls for results
  - `pollJobStatus()`: Polls the backend for job completion status
  - `cancel()`: Cancels ongoing operations
  - `isCurrentlyStreaming`: Property to check if streaming is active
  - `getCurrentJobId()`: Returns the current job ID

### 2. Updated useAgentStream Hook

**File**: `apps/ValyntApp/src/features/workspace/agent/useAgentStream.ts`

Modified the hook to use the real backend API instead of falling back to mocks:

- **Changes**:
  - Set `USE_MOCK_API = false` to enable real backend integration
  - Added import for `AgentOrchestratorAdapter`
  - Updated `sendWithRealAPI()` to use the adapter instead of falling back to mocks
  - Added adapter reference via `useRef` for proper lifecycle management
  - Updated `cancel()` to also cancel the adapter's operations

- **Behavior**:
  - When `useMock` is false, the hook now connects to the backend
  - Uses the coordinator agent by default for routing
  - Passes company name as context to the backend
  - Emits events to the UI store as they arrive from the backend

### 3. Created Unit Tests

**File**: `apps/ValyntApp/src/services/__tests__/AgentOrchestratorAdapter.test.ts`

Comprehensive test suite covering:

- Singleton pattern verification
- Configuration handling
- Agent invocation and polling
- Error handling scenarios
- Polling timeout handling
- Job failure handling
- Cancellation functionality
- Streaming state management
- Job ID tracking

## Architecture

### Frontend Flow

```
User Input → useAgentStream → AgentOrchestratorAdapter → Backend API
                                                              ↓
                                                      UnifiedAgentOrchestrator
                                                              ↓
                                                      AgentMessageQueue (BullMQ)
                                                              ↓
                                                      AgentExecutorService
                                                              ↓
                                                      AgentAPI (HTTP)
                                                              ↓
                                                      Specialized Agents
```

### Backend Flow

```
Frontend Request → /api/agents/:agentId/invoke
                    ↓
              EventProducer (Kafka)
                    ↓
              AgentExecutorService (Consumer)
                    ↓
              UnifiedAgentOrchestrator
                    ↓
              AgentMessageQueue (BullMQ)
                    ↓
              Specialized Agent Execution
                    ↓
              Response Event (Kafka)
                    ↓
              /api/agents/jobs/:jobId (Polling)
```

## API Endpoints Used

### Invoke Agent
- **Endpoint**: `POST /api/agents/:agentId/invoke`
- **Request Body**:
  ```json
  {
    "query": "string",
    "context": "string (JSON)",
    "parameters": "object",
    "sessionId": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "jobId": "string",
      "status": "queued",
      "agentId": "string",
      "estimatedDuration": "string"
    }
  }
  ```

### Get Job Status
- **Endpoint**: `GET /api/agents/jobs/:jobId`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "jobId": "string",
      "status": "queued|processing|completed|failed",
      "agentId": "string",
      "result": "any",
      "error": "string",
      "latency": "number",
      "queuedAt": "string",
      "completedAt": "string"
    }
  }
  ```

## Configuration

### AgentOrchestratorAdapter Config
```typescript
{
  baseUrl: '/api',                    // Backend API base URL
  pollingInterval: 1000,              // Poll every 1 second
  maxPollingAttempts: 60,             // Max 60 attempts (60 seconds)
  timeoutMs: 30000,                   // Request timeout
}
```

### useAgentStream Config
```typescript
{
  useMock: false,                     // Use real backend API
  companyName: 'Target Company',      // Context for the agent
  onComplete: () => {},               // Callback on completion
  onError: (error) => {},             // Callback on error
}
```

## Event Mapping

The adapter maps backend responses to frontend UI events:

### Backend Status → Frontend Events
- **Processing** → `checkpoint_created` (with progress)
- **Completed** → `artifact_proposed` or `message_delta`
- **Failed** → `error` event

### Response Types
- **message**: Converted to `message_delta` events
- **component**: Extracted and converted to `artifact_proposed` events
- **sdui-page**: Converted to `artifact_proposed` events
- **suggestion**: Converted to `clarify_question` events

## Error Handling

### Network Errors
- Caught and converted to `error` events
- Error messages are user-friendly
- Recovery suggestions provided

### Backend Errors
- Job failures are detected via polling
- Error messages from backend are propagated
- Circuit breaker protection prevents cascading failures

### Timeout Handling
- Configurable polling timeout
- Graceful degradation when backend is slow
- Cancellation support for user-initiated aborts

## Testing

### Unit Tests
- Mock backend API responses
- Test all major code paths
- Verify event emission
- Test error scenarios
- Test cancellation

### Integration Tests (Recommended)
- Test with actual backend
- Verify end-to-end flow
- Test with different agent types
- Test with real error scenarios

## Deployment Considerations

### Environment Variables
- `VITE_API_URL`: Backend API base URL (defaults to `/api`)
- `VITE_USE_MOCK_API`: Override to force mock mode (defaults to `false`)

### Monitoring
- Track job completion times
- Monitor polling success rates
- Log error events for debugging
- Track agent invocation patterns

### Scaling
- Backend uses Kafka for event streaming (scales horizontally)
- BullMQ queue for internal orchestration (Redis-backed)
- Circuit breakers prevent cascading failures

## Future Enhancements

### Real-time Updates
- Add Server-Sent Events (SSE) support for real-time updates
- Reduce polling frequency when SSE is available
- Fallback to polling when SSE is unavailable

### Optimizations
- Implement exponential backoff for polling
- Add request deduplication
- Cache agent responses when appropriate
- Implement optimistic UI updates

### Features
- Add support for streaming responses
- Implement resume from checkpoint
- Add agent selection based on query analysis
- Support for multiple concurrent agent invocations

## Migration Path

### From Mock to Real API
1. Set `USE_MOCK_API = false` in `useAgentStream.ts`
2. Ensure backend is running and accessible
3. Verify API endpoints are responding
4. Test with sample queries
5. Monitor error rates and performance

### Rollback Plan
If issues arise, set `USE_MOCK_API = true` to fall back to mock mode.

## References

- **Backend Implementation**: `packages/backend/src/services/UnifiedAgentOrchestrator.ts`
- **Backend API**: `packages/backend/src/api/agents.ts`
- **Frontend Hook**: `apps/ValyntApp/src/features/workspace/agent/useAgentStream.ts`
- **Frontend Service**: `apps/ValyntApp/src/services/agentService.ts`
- **API Adapter**: `apps/ValyntApp/src/features/workspace/agent/api-adapter.ts`
