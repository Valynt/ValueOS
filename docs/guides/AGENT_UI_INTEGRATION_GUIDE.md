# Agent-UI Integration Guide

## Overview

Complete integration of AI agents with the UI layer, providing seamless agent-driven content generation with circuit breaker protection, audit logging, and comprehensive error handling.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      UI Layer                                │
│  - React Components                                          │
│  - useHydratePage Hook                                       │
│  - Error Boundaries                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   AgentOrchestrator                          │
│  - Route requests to appropriate agents                      │
│  - Coordinate multi-agent workflows                          │
│  - Manage agent lifecycle                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      AgentAPI Service                        │
│  - HTTP calls to agent endpoints                             │
│  - Circuit breaker protection                                │
│  - Request/response handling                                 │
│  - Schema validation                                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Audit Logger                               │
│  - Log all agent interactions                                │
│  - Database persistence                                      │
│  - Query and analytics                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. AgentAPI Service

**File**: `src/services/AgentAPI.ts`

Wraps HTTP calls to agent endpoints with circuit breaker protection.

#### Features
- Circuit breaker for each agent type
- Request timeout protection (30s default)
- Automatic retry with exponential backoff
- SDUI schema validation
- Comprehensive error handling
- Audit logging integration

#### Usage

```typescript
import { getAgentAPI } from './services/AgentAPI';

const agentAPI = getAgentAPI();

// Generate value case
const response = await agentAPI.generateValueCase(
  'Generate opportunity page for SaaS company',
  {
    userId: 'user-123',
    organizationId: 'org-456',
  }
);

if (response.success) {
  console.log('Page generated:', response.data);
} else {
  console.error('Error:', response.error);
}
```

#### Available Methods

```typescript
// Opportunity Agent
generateValueCase(query, context): Promise<SDUIPageResponse>

// Target Agent
generateKPIHypothesis(query, context): Promise<AgentResponse>

// Financial Modeling Agent
generateROIModel(query, assumptions, context): Promise<AgentResponse>

// Realization Agent
generateRealizationDashboard(query, context): Promise<SDUIPageResponse>

// Expansion Agent
generateExpansionOpportunities(query, context): Promise<SDUIPageResponse>

// Integrity Agent
validateIntegrity(artifact, context): Promise<AgentResponse>

// Company Intelligence Agent
researchCompany(companyName, context): Promise<AgentResponse>

// Value Mapping Agent
mapValueDrivers(query, context): Promise<AgentResponse>

// Generic invocation
invokeAgent(request): Promise<AgentResponse>
```

#### Circuit Breaker

```typescript
// Check circuit breaker status
const status = agentAPI.getCircuitBreakerStatus('opportunity');
console.log('State:', status.state); // 'closed', 'open', or 'half-open'

// Reset circuit breaker
agentAPI.resetCircuitBreaker('opportunity');

// Reset all circuit breakers
agentAPI.resetAllCircuitBreakers();
```

---

### 2. useHydratePage Hook

**File**: `src/hooks/useHydratePage.ts`

React hook for hydrating SDUI pages from agent responses.

#### Features
- Agent invocation
- Schema validation
- Automatic rendering
- Loading states
- Error handling
- Automatic retry
- Circuit breaker awareness

#### Usage

```typescript
import { useHydratePage } from './hooks/useHydratePage';

function MyPage() {
  const [result, actions] = useHydratePage({
    agent: 'opportunity',
    onHydrationSuccess: (page) => {
      console.log('Page hydrated:', page);
    },
    onHydrationError: (error) => {
      console.error('Hydration failed:', error);
    },
  });

  const handleGenerate = () => {
    actions.hydrate('Generate opportunity page');
  };

  return (
    <div>
      <button onClick={handleGenerate}>Generate</button>
      
      {result.state === 'loading' && <div>Loading...</div>}
      {result.state === 'success' && result.rendered?.element}
      {result.state === 'error' && (
        <div>
          Error: {result.error?.message}
          <button onClick={actions.retry}>Retry</button>
        </div>
      )}
    </div>
  );
}
```

#### Options

```typescript
interface UseHydratePageOptions {
  agent: AgentType;                    // Required
  context?: AgentContext;              // Optional context
  renderOptions?: RenderPageOptions;   // Render configuration
  autoHydrate?: boolean;               // Auto-hydrate on mount
  initialQuery?: string;               // Query for auto-hydration
  onHydrationStart?: (query) => void;
  onHydrationSuccess?: (page) => void;
  onHydrationError?: (error) => void;
  onValidationError?: (errors) => void;
  enableRetry?: boolean;               // Default: true
  maxRetries?: number;                 // Default: 3
  retryDelay?: number;                 // Default: 1000ms
}
```

#### Result

```typescript
interface HydrationResult {
  state: 'idle' | 'loading' | 'success' | 'error';
  page: SDUIPageDefinition | null;
  rendered: RenderPageResult | null;
  error: Error | null;
  validationErrors: string[];
  warnings: string[];
  confidence: number | null;
  metadata: { agent, duration, timestamp } | null;
  retryCount: number;
  circuitBreakerOpen: boolean;
}
```

#### Actions

```typescript
interface HydrationActions {
  hydrate: (query: string) => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
  resetCircuitBreaker: () => void;
}
```

---

### 3. AgentOrchestrator Integration

**File**: `src/services/AgentOrchestrator.ts`

Updated to use AgentAPI instead of mock logic.

#### New Methods

```typescript
// Generate SDUI page
await orchestrator.generateSDUIPage(
  'opportunity',
  'Generate opportunity page',
  context
);

// Generate and render page
const { response, rendered } = await orchestrator.generateAndRenderPage(
  'opportunity',
  'Generate page',
  context,
  renderOptions
);

// Get circuit breaker status
const status = orchestrator.getAgentCircuitBreakerStatus('opportunity');

// Reset circuit breaker
orchestrator.resetAgentCircuitBreaker('opportunity');
```

---

### 4. Audit Logging

**File**: `src/services/AgentAuditLogger.ts`

Centralized logging system for all agent interactions.

#### Features
- Database persistence (Supabase)
- Automatic log flushing
- Query and filtering
- Statistics and analytics
- Retention management

#### Usage

```typescript
import { getAuditLogger } from './services/AgentAuditLogger';

const logger = getAuditLogger();

// Query logs
const logs = await logger.query({
  agent: 'opportunity',
  success: true,
  limit: 50,
});

// Get statistics
const stats = await logger.getStats({
  startDate: new Date('2025-01-01'),
  endDate: new Date(),
});

console.log('Total requests:', stats.totalRequests);
console.log('Success rate:', stats.successfulRequests / stats.totalRequests);
console.log('Average duration:', stats.averageDuration);

// Get recent logs
const recent = await logger.getRecent(50);

// Get logs by agent
const opportunityLogs = await logger.getByAgent('opportunity', 50);

// Get logs by user
const userLogs = await logger.getByUser('user-123', 50);

// Delete old logs
const deleted = await logger.deleteOldLogs(90); // Keep 90 days
```

#### Automatic Logging

All AgentAPI calls are automatically logged with:
- Agent name
- Input query
- Request context
- Response data (sanitized)
- Response metadata (duration, confidence, tokens)
- Success/failure status
- Error messages
- Timestamps

---

### 5. Error Boundaries

**File**: `src/components/Agent/AgentErrorBoundary.tsx`

Specialized error boundary for agent-driven content.

#### Features
- Circuit breaker awareness
- Retry capability
- Custom fallback UI
- Error details in development
- Production-safe error display

#### Usage

```typescript
import { AgentErrorBoundary } from './components/Agent';

<AgentErrorBoundary
  agent="opportunity"
  circuitBreakerOpen={circuitBreakerOpen}
  onRetry={handleRetry}
  onError={(error, errorInfo) => {
    console.error('Agent error:', error);
  }}
>
  {/* Agent-driven content */}
</AgentErrorBoundary>
```

#### Fallback Components

```typescript
// Loading fallback
<AgentLoadingFallback
  agent="opportunity"
  message="Generating content..."
/>

// Validation error fallback
<AgentValidationErrorFallback
  errors={validationErrors}
  onRetry={handleRetry}
/>
```

---

### 6. Audit Log UI

**File**: `src/views/Settings/AgentAuditLogView.tsx`

UI for viewing and analyzing agent interaction logs.

#### Features
- Real-time log viewing
- Filtering by agent, status, date
- Search functionality
- Statistics dashboard
- Export to CSV
- Log detail modal

#### Access

Navigate to Settings → Agent Audit Logs

---

## Complete Integration Example

```typescript
import React from 'react';
import { useHydratePage } from './hooks/useHydratePage';
import {
  AgentErrorBoundary,
  AgentLoadingFallback,
  AgentValidationErrorFallback,
} from './components/Agent';

function OpportunityPage() {
  const [result, actions] = useHydratePage({
    agent: 'opportunity',
    context: {
      userId: 'user-123',
      organizationId: 'org-456',
      sessionId: 'session-789',
    },
    renderOptions: {
      debug: false,
      onComponentRender: (name, props) => {
        console.log(`Rendered ${name}`);
      },
    },
    enableRetry: true,
    maxRetries: 3,
    onHydrationSuccess: (page) => {
      console.log('Page generated successfully');
    },
    onHydrationError: (error) => {
      console.error('Generation failed:', error);
    },
  });

  const handleGenerate = () => {
    actions.hydrate('Generate opportunity discovery page for enterprise SaaS');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Opportunity Discovery</h1>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={result.state === 'loading' || result.circuitBreakerOpen}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Generate Page
          </button>
          {result.state === 'error' && (
            <button
              onClick={actions.retry}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Metadata */}
      {result.metadata && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-white border rounded-lg">
            <p className="text-sm text-gray-600">Duration</p>
            <p className="text-lg font-semibold">{result.metadata.duration}ms</p>
          </div>
          <div className="p-4 bg-white border rounded-lg">
            <p className="text-sm text-gray-600">Confidence</p>
            <p className="text-lg font-semibold">
              {result.confidence ? `${(result.confidence * 100).toFixed(0)}%` : 'N/A'}
            </p>
          </div>
          <div className="p-4 bg-white border rounded-lg">
            <p className="text-sm text-gray-600">Retries</p>
            <p className="text-lg font-semibold">{result.retryCount}</p>
          </div>
          <div className="p-4 bg-white border rounded-lg">
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-lg font-semibold capitalize">{result.state}</p>
          </div>
        </div>
      )}

      {/* Content */}
      <AgentErrorBoundary
        agent="opportunity"
        circuitBreakerOpen={result.circuitBreakerOpen}
        onRetry={actions.retry}
        showDetails={process.env.NODE_ENV === 'development'}
      >
        {result.state === 'loading' && (
          <AgentLoadingFallback agent="opportunity" />
        )}

        {result.state === 'error' && result.validationErrors.length > 0 && (
          <AgentValidationErrorFallback
            errors={result.validationErrors}
            onRetry={actions.retry}
          />
        )}

        {result.state === 'success' && result.rendered && (
          <div>{result.rendered.element}</div>
        )}
      </AgentErrorBoundary>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-semibold text-yellow-900 mb-2">Warnings:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-800">
            {result.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default OpportunityPage;
```

---

## Configuration

### AgentAPI Configuration

```typescript
import { getAgentAPI } from './services/AgentAPI';

const agentAPI = getAgentAPI({
  baseUrl: '/api/agents',           // Default: '/api/agents'
  timeout: 30000,                   // Default: 30000ms
  enableCircuitBreaker: true,       // Default: true
  failureThreshold: 5,              // Default: 5
  cooldownPeriod: 60000,            // Default: 60000ms
  enableLogging: true,              // Default: false
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

### Audit Logger Configuration

```typescript
import { getAuditLogger } from './services/AgentAuditLogger';

const logger = getAuditLogger();

// Enable/disable logging
logger.setEnabled(true);

// Manual flush
await logger.flush();

// Cleanup
await logger.cleanup();
```

---

## Database Schema

### agent_audit_logs Table

```sql
CREATE TABLE agent_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name TEXT NOT NULL,
  input_query TEXT NOT NULL,
  context JSONB,
  response_data JSONB,
  response_metadata JSONB,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID,
  organization_id UUID,
  session_id TEXT,
  metadata JSONB
);

CREATE INDEX idx_agent_audit_logs_agent ON agent_audit_logs(agent_name);
CREATE INDEX idx_agent_audit_logs_user ON agent_audit_logs(user_id);
CREATE INDEX idx_agent_audit_logs_org ON agent_audit_logs(organization_id);
CREATE INDEX idx_agent_audit_logs_timestamp ON agent_audit_logs(timestamp DESC);
CREATE INDEX idx_agent_audit_logs_success ON agent_audit_logs(success);
```

---

## Best Practices

### 1. Always Use Error Boundaries

Wrap agent-driven content in error boundaries:

```typescript
<AgentErrorBoundary agent="opportunity" onRetry={handleRetry}>
  {/* Agent content */}
</AgentErrorBoundary>
```

### 2. Handle Circuit Breaker State

Check and handle circuit breaker state:

```typescript
if (result.circuitBreakerOpen) {
  return <CircuitBreakerFallback onReset={actions.resetCircuitBreaker} />;
}
```

### 3. Provide Context

Always provide user and organization context:

```typescript
const [result, actions] = useHydratePage({
  agent: 'opportunity',
  context: {
    userId: currentUser.id,
    organizationId: currentOrg.id,
    sessionId: sessionId,
  },
});
```

### 4. Monitor Performance

Track agent performance metrics:

```typescript
const [result, actions] = useHydratePage({
  agent: 'opportunity',
  onHydrationSuccess: (page) => {
    metrics.track('agent.success', {
      agent: 'opportunity',
      duration: result.metadata?.duration,
      confidence: result.confidence,
    });
  },
});
```

### 5. Handle Validation Errors

Show validation errors to users:

```typescript
{result.validationErrors.length > 0 && (
  <AgentValidationErrorFallback
    errors={result.validationErrors}
    onRetry={actions.retry}
  />
)}
```

---

## Troubleshooting

### Circuit Breaker is Open

**Problem**: Agent requests are being blocked

**Solution**:
1. Check agent service health
2. Review recent error logs
3. Reset circuit breaker if service is healthy
4. Wait for automatic recovery (cooldown period)

```typescript
// Reset circuit breaker
actions.resetCircuitBreaker();

// Or via AgentAPI
agentAPI.resetCircuitBreaker('opportunity');
```

### Validation Errors

**Problem**: Agent response fails schema validation

**Solution**:
1. Check validation errors in result
2. Review agent response format
3. Update schema if needed
4. Retry with different query

### Slow Response Times

**Problem**: Agent requests taking too long

**Solution**:
1. Check network connectivity
2. Review agent service performance
3. Increase timeout if needed
4. Optimize query complexity

```typescript
const agentAPI = getAgentAPI({
  timeout: 60000, // Increase to 60 seconds
});
```

### Audit Logs Not Appearing

**Problem**: Logs not being saved

**Solution**:
1. Check database connection
2. Verify table exists
3. Check logger is enabled
4. Manual flush if needed

```typescript
const logger = getAuditLogger();
logger.setEnabled(true);
await logger.flush();
```

---

## Testing

### Unit Tests

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useHydratePage } from './hooks/useHydratePage';

test('useHydratePage hydrates successfully', async () => {
  const { result } = renderHook(() =>
    useHydratePage({ agent: 'opportunity' })
  );

  await act(async () => {
    await result.current[1].hydrate('Generate page');
  });

  expect(result.current[0].state).toBe('success');
  expect(result.current[0].page).toBeDefined();
});
```

### Integration Tests

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OpportunityPage from './OpportunityPage';

test('generates page on button click', async () => {
  render(<OpportunityPage />);

  const button = screen.getByText('Generate Page');
  fireEvent.click(button);

  await waitFor(() => {
    expect(screen.getByTestId('sdui-page-renderer')).toBeInTheDocument();
  });
});
```

---

## Performance Considerations

### 1. Request Caching

AgentAPI doesn't cache by default. Implement caching at application level if needed.

### 2. Parallel Requests

Use multiple hooks for parallel agent invocations:

```typescript
const [opp, oppActions] = useHydratePage({ agent: 'opportunity' });
const [target, targetActions] = useHydratePage({ agent: 'target' });

// Trigger both in parallel
Promise.all([
  oppActions.hydrate('query 1'),
  targetActions.hydrate('query 2'),
]);
```

### 3. Debounce User Input

Debounce user input before triggering hydration:

```typescript
const debouncedHydrate = useMemo(
  () => debounce(actions.hydrate, 500),
  [actions.hydrate]
);
```

---

## Security

### 1. Authentication

Always include authentication in headers:

```typescript
const agentAPI = getAgentAPI({
  headers: {
    'Authorization': `Bearer ${getAuthToken()}`,
  },
});
```

### 2. Input Sanitization

Sanitize user input before sending to agents:

```typescript
const sanitizedQuery = DOMPurify.sanitize(userInput);
await actions.hydrate(sanitizedQuery);
```

### 3. Response Validation

Always validate agent responses:

```typescript
if (response.validation && !response.validation.valid) {
  throw new Error('Invalid response');
}
```

---

## Support

For questions or issues:
- Review examples in `src/examples/AgentIntegrationExamples.tsx`
- Check audit logs in Settings → Agent Audit Logs
- Review error messages in browser console
- Check circuit breaker status

---

**Version**: 1.0  
**Last Updated**: November 18, 2025  
**Status**: Production-Ready
