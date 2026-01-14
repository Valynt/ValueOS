# Canvas Architecture Migration Checklist

## Phase 1: State Management Migration ✅ IN PROGRESS

### Step 1.1: Add New Hooks (Completed)
- [x] Import `useCanvasState` hook
- [x] Import `useSessionManagement` hook
- [x] Import `useAgentChatService` hook
- [x] Add new state alongside existing state

### Step 1.2: Migrate Individual Functions (In Progress)
- [x] `handleCaseSelect` - Added migration comments
- [ ] `handleCommand` - Update to use new streaming actions
- [ ] Modal management functions - Use new modal actions
- [ ] Form handling functions - Use new form actions
- [ ] User context functions - Use new user actions

### Step 1.3: Update Component Rendering (Pending)
- [ ] Replace old state references with new state
- [ ] Update conditional rendering logic
- [ ] Update event handlers

### Step 1.4: Remove Old State (Pending)
- [ ] Remove individual useState hooks
- [ ] Clean up old state variables
- [ ] Update TypeScript types

## Phase 2: Session Management Migration (Pending)

### Step 2.1: Replace Session Logic
- [ ] Replace `workflowStateService` instantiation
- [ ] Update session initialization logic
- [ ] Replace session persistence calls

### Step 2.2: Update Session Effects
- [ ] Replace session lifecycle effects
- [ ] Update session validation logic
- [ ] Add session cleanup

## Phase 3: Type Safety Migration (Pending)

### Step 3.1: Replace `any` Types
- [ ] Update function parameters to use strict types
- [ ] Update component props to use enhanced types
- [ ] Add type guards where needed

### Step 3.2: Add Validation
- [ ] Add runtime type validation
- [ ] Add error boundaries with proper typing
- [ ] Update error handling

## Phase 4: Service Locator Migration (Pending)

### Step 4.1: Replace Direct Service Usage
- [ ] Replace `agentChatService` import with hook
- [ ] Replace `workflowStateService` with hook
- [ ] Update service instantiation

### Step 4.2: Add Testing Support
- [ ] Wrap components with ServiceProvider
- [ ] Update test files to use mock services
- [ ] Add service health checks

## Migration Examples

### Before: Individual State Management
```typescript
// Multiple useState hooks
const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [streamingUpdate, setStreamingUpdate] = useState<StreamingUpdate | null>(null);

// Individual setters
const handleCaseSelect = (id: string) => setSelectedCaseId(id);
const startLoading = () => setIsLoading(true);
const setStreaming = (update: StreamingUpdate) => setStreamingUpdate(update);
```

### After: Consolidated State Management
```typescript
// Single consolidated hook
const {
  state,
  actions,
  hasSelectedCase,
  canSubmitCommand,
  isStreaming,
} = useCanvasState();

// Consolidated actions
const handleCaseSelect = (id: string) => actions.selectCaseAndReset(id);
const startLoading = () => actions.setLoading(true);
const setStreaming = (update: StreamingUpdate) => actions.setStreamingUpdate(update);
```

### Before: Direct Service Usage
```typescript
import { agentChatService } from '../../services/AgentChatService';
import { WorkflowStateService } from '../../services/WorkflowStateService';

const workflowStateService = useMemo(() => new WorkflowStateService(supabase), []);
const result = await agentChatService.chat(request);
```

### After: Service Locator
```typescript
import { useAgentChatService, useWorkflowStateService } from './services/ServiceLocator';

const agentChatService = useAgentChatService();
const workflowStateService = useWorkflowStateService();
const result = await agentChatService.chat(request);
```

## Testing Strategy

### Unit Tests with New Architecture
```typescript
import { createMockServices, ServiceLocatorTestHelper } from './services/ServiceLocator';

describe('ChatCanvasLayout with New Architecture', () => {
  let testHelper: ServiceLocatorTestHelper;

  beforeEach(() => {
    testHelper = new ServiceLocatorTestHelper();
    testHelper.setupMockServices({
      agentChatService: {
        chat: jest.fn().mockResolvedValue(mockResponse),
      },
    });
  });

  it('should handle commands with new state management', async () => {
    const TestComponent = testHelper.createTestServiceProvider();

    render(
      <TestComponent>
        <ChatCanvasLayout />
      </TestComponent>
    );

    // Test with mocked services and new state
  });
});
```

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback**: Comment out new hooks, revert to old state
2. **Partial Rollback**: Keep new hooks but revert specific functions
3. **Gradual Rollback**: Remove new features one by one

## Performance Monitoring

Track these metrics during migration:

- **Render Performance**: Component render times
- **Memory Usage**: State management overhead
- **Bundle Size**: Additional code from new architecture
- **Error Rates**: Type safety improvements

## Next Steps

1. **Complete streaming logic migration**
2. **Update modal management**
3. **Add session management integration**
4. **Update component props with enhanced types**
5. **Add service locator wrapper to app**
6. **Update tests with new architecture**

## Notes

- Migration is designed to be incremental
- Old and new code can coexist during transition
- TypeScript will help catch issues during migration
- Tests should be updated gradually alongside code changes
