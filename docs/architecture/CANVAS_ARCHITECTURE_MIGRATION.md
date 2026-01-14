# Canvas Architecture Improvements: Migration Guide

This guide shows how to migrate from the existing ChatCanvasLayout to use the new consolidated state management, session management, enhanced types, and service locator pattern.

## Overview of Improvements

### ✅ Completed Improvements

1. **Consolidated State Management** (High Priority)
   - Replaced 20+ useState hooks with single useReducer
   - Predictable state updates with action creators
   - Better performance with memoized selectors

2. **Dedicated Session Management** (Medium Priority)
   - Centralized session logic in dedicated hook
   - Automatic session validation and cleanup
   - Better error handling and recovery

3. **Enhanced Type Definitions** (Medium Priority)
   - Replaced all `any` types with strict interfaces
   - Added type guards and validation
   - Better developer experience with IntelliSense

4. **Service Locator Pattern** (Low Priority)
   - Dependency injection for better testability
   - Mock service factory for testing
   - Service health monitoring

## Migration Steps

### Step 1: Update ChatCanvasLayout to use new state management

**Before:**
```typescript
// Multiple useState hooks
const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
const [renderedPage, setRenderedPage] = useState<RenderPageResult | null>(null);
// ... 17 more state variables
```

**After:**
```typescript
// Single consolidated state hook
import { useCanvasState } from './hooks/useCanvasStateHook';

export const ChatCanvasLayout: FC<ChatCanvasLayoutProps> = (props) => {
  const {
    state,
    actions,
    hasSelectedCase,
    canSubmitCommand,
    isStreaming,
    anyModalOpen,
    currentStage,
  } = useCanvasState();

  // Use actions instead of individual setters
  const handleCaseSelect = (caseId: string) => {
    actions.selectCaseAndReset(caseId);
  };

  const handleCommand = async (query: string) => {
    if (!canSubmitCommand) return;

    actions.startStreaming('Analyzing your request...');
    try {
      // Process command...
      actions.setRenderedPage(result);
    } finally {
      actions.stopStreaming();
    }
  };
};
```

### Step 2: Integrate session management

**Before:**
```typescript
// Scattered session logic
const workflowStateService = useMemo(() => new WorkflowStateService(supabase), []);
const actualSessionId = currentSessionId || sessionId;
if (currentSessionId) {
  await workflowStateService.saveWorkflowState(currentSessionId, nextState, currentTenantId);
}
```

**After:**
```typescript
// Centralized session management
import { useSessionManagement } from './hooks/useSessionManagement';

export const ChatCanvasLayout: FC<ChatCanvasLayoutProps> = (props) => {
  const {
    sessionState,
    loadOrCreateSession,
    saveWorkflowState,
    hasActiveSession,
    validateSession,
  } = useSessionManagement();

  // Initialize session when case is selected
  useEffect(() => {
    if (selectedCase && userContext && !hasActiveSession) {
      loadOrCreateSession({
        caseId: selectedCase.id,
        userId: userContext.currentUserId,
        tenantId: userContext.currentTenantId,
        initialStage: selectedCase.stage,
        context: { company: selectedCase.company },
      });
    }
  }, [selectedCase, userContext, hasActiveSession]);

  // Save workflow state
  const handleWorkflowUpdate = async (newState: WorkflowState) => {
    if (validateSession()) {
      await saveWorkflowState(newState);
    }
  };
};
```

### Step 3: Use enhanced types

**Before:**
```typescript
// Loose typing
interface Props {
  renderedPage: any; // TODO: Type this properly
  streamingUpdate: any; // TODO: Type this properly
  workflowState: any; // TODO: Type this properly
}

const handleResponse = (response: any) => {
  // No type safety
};
```

**After:**
```typescript
// Strong typing
import {
  TypedChatRequest,
  TypedChatResponse,
  TypedStreamingUpdate,
  StrictCanvasWorkspaceProps,
  isValidChatRequest,
  isValidStreamingUpdate
} from './types';

interface Props extends StrictCanvasWorkspaceProps {
  // All props are now strongly typed
}

const handleResponse = (response: unknown) => {
  if (isValidChatRequest(response)) {
    // Type-safe access to response properties
    console.log(response.query); // TypeScript knows this exists
    console.log(response.caseId); // Fully typed
  }
};

const handleStreamingUpdate = (update: unknown) => {
  if (isValidStreamingUpdate(update)) {
    // Type-safe streaming update handling
    console.log(`${update.stage}: ${update.message}`);
  }
};
```

### Step 4: Implement service locator for testability

**Before:**
```typescript
// Direct service instantiation (hard to test)
import { agentChatService } from '../../services/AgentChatService';
import { WorkflowStateService } from '../../services/WorkflowStateService';

const workflowStateService = new WorkflowStateService(supabase);

// Hard to mock in tests
const result = await agentChatService.chat(request);
```

**After:**
```typescript
// Service locator with dependency injection
import { useAgentChatService, useWorkflowStateService } from './services/ServiceLocator';

export const ChatCanvasLayout: FC<ChatCanvasLayoutProps> = (props) => {
  const agentChatService = useAgentChatService();
  const workflowStateService = useWorkflowStateService();

  // Easy to mock in tests
  const result = await agentChatService.chat(request);
};

// Wrap app with ServiceProvider
export const App = () => (
  <ServiceProvider>
    <ChatCanvasLayout />
  </ServiceProvider>
);
```

### Step 5: Testing with new architecture

**Before:**
```typescript
// Difficult to test due to direct dependencies
describe('ChatCanvasLayout', () => {
  it('should handle commands', () => {
    // Hard to mock services
    // Need to mock supabase, etc.
  });
});
```

**After:**
```typescript
// Easy testing with service locator
import { createMockServices, ServiceLocatorTestHelper } from './services/ServiceLocator';

describe('ChatCanvasLayout', () => {
  let testHelper: ServiceLocatorTestHelper;

  beforeEach(() => {
    testHelper = new ServiceLocatorTestHelper();
    testHelper.setupMockServices({
      agentChatService: {
        chat: jest.fn().mockResolvedValue({
          message: { content: 'Test response' },
          nextState: { currentStage: 'target' },
        }),
      },
    });
  });

  afterEach(() => {
    testHelper.restoreOriginalServices();
  });

  it('should handle commands', async () => {
    const TestComponent = testHelper.createTestServiceProvider();

    render(
      <TestComponent>
        <ChatCanvasLayout />
      </TestComponent>
    );

    // Test with mocked services
    // No need to mock supabase or other dependencies
  });
});
```

## Benefits of Migration

### Performance Improvements
- **Reduced re-renders**: Consolidated state management prevents unnecessary updates
- **Better memoization**: Smart selectors prevent expensive computations
- **Optimized session handling**: Efficient database queries and caching

### Developer Experience
- **Type safety**: Full IntelliSense support and compile-time error checking
- **Predictable state**: Action creators make state changes explicit and debuggable
- **Better testing**: Service locator enables easy mocking and dependency injection

### Maintainability
- **Centralized logic**: Session and state management in dedicated hooks
- **Clear separation**: Each layer has distinct responsibilities
- **Error boundaries**: Better error handling and recovery mechanisms

## Gradual Migration Strategy

You can migrate gradually:

1. **Phase 1**: Add new hooks alongside existing code
2. **Phase 2**: Migrate one feature at a time (e.g., start with modal management)
3. **Phase 3**: Replace old state management completely
4. **Phase 4**: Add service locator and update tests

## Example: Complete Migrated Component

```typescript
import React, { FC, useEffect } from 'react';
import { useCanvasState } from './hooks/useCanvasStateHook';
import { useSessionManagement } from './hooks/useSessionManagement';
import { useAgentChatService } from './services/ServiceLocator';
import { TypedChatRequest, isValidChatRequest } from './types';

export const ChatCanvasLayout: FC<ChatCanvasLayoutProps> = ({
  onSettingsClick,
  onHelpClick,
  initialAction,
}) => {
  // Consolidated state management
  const {
    state,
    actions,
    hasSelectedCase,
    canSubmitCommand,
    isStreaming,
  } = useCanvasState();

  // Session management
  const {
    sessionState,
    loadOrCreateSession,
    saveWorkflowState,
    hasActiveSession,
  } = useSessionManagement();

  // Service locator
  const agentChatService = useAgentChatService();

  // Handle command submission
  const handleCommand = async (query: string) => {
    if (!canSubmitCommand || !hasActiveSession) return;

    actions.startStreaming('Analyzing your request...');

    try {
      const request: TypedChatRequest = {
        query,
        caseId: state.selectedCaseId!,
        userId: sessionState.sessionContext!.userId,
        sessionId: sessionState.sessionContext!.sessionId,
        tenantId: sessionState.sessionContext!.tenantId,
        workflowState: state.workflowState!,
      };

      const response = await agentChatService.chat(request);

      actions.setWorkflowState(response.nextState);
      actions.setRenderedPage(response.sduiPage ? { element: response.sduiPage, warnings: [], metadata: { componentCount: 1, hydratedComponentCount: 0, version: 1 } } : null);

      await saveWorkflowState(response.nextState);

    } catch (error) {
      console.error('Command failed:', error);
    } finally {
      actions.stopStreaming();
    }
  };

  // Initialize session when case is selected
  useEffect(() => {
    if (state.selectedCaseId && !hasActiveSession) {
      // Load or create session logic
    }
  }, [state.selectedCaseId, hasActiveSession]);

  return (
    <div className="chat-canvas-layout">
      {/* Component JSX using consolidated state */}
    </div>
  );
};
```

This migration provides a solid foundation for future development while maintaining backward compatibility and improving overall code quality.
