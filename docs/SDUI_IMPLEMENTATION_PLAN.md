# SDUI Implementation Plan

## Overview

This document provides a detailed implementation plan to achieve full SDUI capability in ValueCanvas. The plan is structured in 4 phases over 6-8 weeks.

**Goal**: Transform ValueCanvas from a hybrid React/SDUI architecture to a fully server-driven UI where the server controls all UI composition, state, and behavior.

---

## Phase 1: Core Integration (Weeks 1-2)

### Objective
Establish the foundational integration layer connecting SDUI engine to the application.

### 1.1 Canvas Schema Service

**Purpose**: Server-side service that generates SDUI page definitions based on workspace state.

**Location**: `src/services/CanvasSchemaService.ts`

**Responsibilities**:
- Determine current workspace state (lifecycle stage, data availability)
- Fetch required data from Value Fabric
- Select appropriate SDUI template
- Generate complete SDUI page definition
- Handle schema caching and invalidation

**API**:
```typescript
class CanvasSchemaService {
  /**
   * Generate SDUI schema for a workspace
   */
  async generateSchema(
    workspaceId: string,
    context: WorkspaceContext
  ): Promise<SDUIPageDefinition>;

  /**
   * Update schema based on action result
   */
  async updateSchema(
    workspaceId: string,
    action: CanonicalAction,
    result: ActionResult
  ): Promise<SDUIPageDefinition>;

  /**
   * Get cached schema if available
   */
  getCachedSchema(workspaceId: string): SDUIPageDefinition | null;

  /**
   * Invalidate schema cache
   */
  invalidateCache(workspaceId: string): void;
}
```

**Implementation Steps**:
1. Create `CanvasSchemaService` class
2. Implement workspace state detection logic
3. Integrate with existing SDUI templates
4. Add data fetching from Value Fabric
5. Implement schema caching with Redis
6. Add error handling and fallbacks
7. Write unit tests

**Dependencies**:
- Value Fabric Service (existing)
- SDUI Templates (existing)
- Redis Cache Service (existing)

**Estimated Effort**: 3-4 days

---

### 1.2 Action Router

**Purpose**: Central router for all user interactions, enforcing governance and routing to appropriate handlers.

**Location**: `src/services/ActionRouter.ts`

**Responsibilities**:
- Receive canonical actions from UI
- Validate action structure
- Enforce Manifesto rules
- Route to appropriate handler (agent, workflow, service)
- Return action result
- Trigger SDUI schema updates

**Canonical Actions**:
```typescript
type CanonicalAction =
  | { type: 'invokeAgent'; agentId: string; input: any; context: any }
  | { type: 'runWorkflowStep'; workflowId: string; stepId: string; input: any }
  | { type: 'updateValueTree'; treeId: string; updates: any }
  | { type: 'updateAssumption'; assumptionId: string; updates: any }
  | { type: 'exportArtifact'; artifactType: string; format: string }
  | { type: 'openAuditTrail'; entityId: string; entityType: string }
  | { type: 'showExplanation'; componentId: string; topic: string }
  | { type: 'navigateToStage'; stage: LifecycleStage }
  | { type: 'saveWorkspace'; workspaceId: string }
  | { type: 'mutateComponent'; action: AtomicUIAction };
```

**API**:
```typescript
class ActionRouter {
  /**
   * Route an action to appropriate handler
   */
  async routeAction(
    action: CanonicalAction,
    context: ActionContext
  ): Promise<ActionResult>;

  /**
   * Validate action before routing
   */
  validateAction(action: CanonicalAction): ValidationResult;

  /**
   * Check Manifesto rules for action
   */
  async checkManifestoRules(
    action: CanonicalAction,
    context: ActionContext
  ): Promise<ManifestoCheckResult>;

  /**
   * Register action handler
   */
  registerHandler(
    actionType: string,
    handler: ActionHandler
  ): void;
}
```

**Implementation Steps**:
1. Create `ActionRouter` class
2. Define canonical action types
3. Implement action validation
4. Integrate Manifesto rules engine
5. Create handler registry
6. Implement default handlers for each action type
7. Add audit logging for all actions
8. Write unit tests

**Dependencies**:
- Manifesto Rules Engine (existing)
- Agent Orchestrator (existing)
- Workflow Orchestrator (existing)
- Audit Log Service (existing)

**Estimated Effort**: 4-5 days

---

### 1.3 SDUI App Integration

**Purpose**: Replace traditional React routing with SDUI-driven rendering.

**Location**: `src/App.tsx`, `src/components/SDUIApp.tsx`

**Changes Required**:

**Before** (Traditional React):
```typescript
function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('library');
  
  const renderView = () => {
    switch (currentView) {
      case 'opportunity':
        return <OpportunityWorkspace />;
      case 'target':
        return <TargetROIWorkspace />;
      // ... more cases
    }
  };
  
  return <div>{renderView()}</div>;
}
```

**After** (SDUI-Driven):
```typescript
function App() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [schema, setSchema] = useState<SDUIPageDefinition | null>(null);
  
  useEffect(() => {
    if (workspaceId) {
      loadSchema(workspaceId);
    }
  }, [workspaceId]);
  
  const loadSchema = async (id: string) => {
    const schema = await canvasSchemaService.generateSchema(id, context);
    setSchema(schema);
  };
  
  const handleAction = async (action: CanonicalAction) => {
    const result = await actionRouter.routeAction(action, context);
    if (result.success) {
      const newSchema = await canvasSchemaService.updateSchema(
        workspaceId,
        action,
        result
      );
      setSchema(newSchema);
    }
  };
  
  if (!schema) return <LoadingView />;
  
  const renderResult = renderPage(schema, {
    onAction: handleAction,
    debug: process.env.NODE_ENV === 'development',
  });
  
  return <div>{renderResult.element}</div>;
}
```

**Implementation Steps**:
1. Create `SDUIApp` component
2. Implement schema loading logic
3. Integrate Canvas Schema Service
4. Integrate Action Router
5. Add action handling callback
6. Implement loading and error states
7. Add schema caching
8. Migrate App.tsx to use SDUIApp
9. Write integration tests

**Dependencies**:
- Canvas Schema Service (Phase 1.1)
- Action Router (Phase 1.2)
- SDUI Runtime Engine (existing)

**Estimated Effort**: 3-4 days

---

### Phase 1 Deliverables

- ✅ Canvas Schema Service implemented and tested
- ✅ Action Router implemented and tested
- ✅ SDUI App integration complete
- ✅ Basic end-to-end flow working (load workspace → render SDUI → handle action → update UI)
- ✅ Documentation updated

**Total Phase 1 Effort**: 10-13 days (2 weeks)

---

## Phase 2: Agent Integration (Weeks 3-4)

### Objective
Connect agents to the SDUI pipeline so agent outputs automatically trigger UI updates.

### 2.1 Agent Output → SDUI Pipeline

**Purpose**: Convert agent outputs to SDUI schema updates.

**Location**: `src/services/AgentSDUIAdapter.ts`

**Responsibilities**:
- Receive agent output
- Determine UI impact
- Generate SDUI schema updates
- Trigger schema regeneration

**API**:
```typescript
class AgentSDUIAdapter {
  /**
   * Process agent output and generate SDUI update
   */
  async processAgentOutput(
    agentId: string,
    output: AgentOutput,
    workspaceId: string
  ): Promise<SDUIUpdate>;

  /**
   * Determine which components need updates
   */
  analyzeImpact(
    output: AgentOutput,
    currentSchema: SDUIPageDefinition
  ): ComponentImpact[];

  /**
   * Generate atomic UI actions from agent output
   */
  generateAtomicActions(
    output: AgentOutput,
    impact: ComponentImpact[]
  ): AtomicUIAction[];
}
```

**Implementation Steps**:
1. Create `AgentSDUIAdapter` class
2. Define agent output → SDUI mapping rules
3. Implement impact analysis
4. Generate atomic UI actions
5. Integrate with Canvas Schema Service
6. Add agent output listeners
7. Write unit tests

**Estimated Effort**: 4-5 days

---

### 2.2 Workflow → SDUI Integration

**Purpose**: Workflow stage transitions trigger SDUI updates.

**Location**: `src/services/WorkflowSDUIAdapter.ts`

**Responsibilities**:
- Listen to workflow events
- Generate SDUI updates on stage transitions
- Update progress indicators
- Show stage-specific components

**API**:
```typescript
class WorkflowSDUIAdapter {
  /**
   * Handle workflow stage transition
   */
  async onStageTransition(
    workflowId: string,
    fromStage: string,
    toStage: string,
    context: any
  ): Promise<SDUIUpdate>;

  /**
   * Update workflow progress UI
   */
  async updateProgress(
    workflowId: string,
    progress: WorkflowProgress
  ): Promise<AtomicUIAction[]>;

  /**
   * Show stage-specific components
   */
  async showStageComponents(
    stage: LifecycleStage,
    workspaceId: string
  ): Promise<SDUIPageDefinition>;
}
```

**Implementation Steps**:
1. Create `WorkflowSDUIAdapter` class
2. Integrate with Workflow Orchestrator events
3. Implement stage transition handlers
4. Generate progress UI updates
5. Add stage-specific component logic
6. Write unit tests

**Estimated Effort**: 3-4 days

---

### 2.3 Server-Side State Management

**Purpose**: Manage workspace state on the server, sync to client.

**Location**: `src/services/WorkspaceStateService.ts`

**Responsibilities**:
- Maintain workspace state on server
- Sync state to client
- Handle state updates from actions
- Persist state to database

**API**:
```typescript
class WorkspaceStateService {
  /**
   * Get current workspace state
   */
  async getState(workspaceId: string): Promise<WorkspaceState>;

  /**
   * Update workspace state
   */
  async updateState(
    workspaceId: string,
    updates: Partial<WorkspaceState>
  ): Promise<WorkspaceState>;

  /**
   * Subscribe to state changes
   */
  subscribeToChanges(
    workspaceId: string,
    callback: (state: WorkspaceState) => void
  ): Unsubscribe;

  /**
   * Persist state to database
   */
  async persistState(workspaceId: string): Promise<void>;
}
```

**Implementation Steps**:
1. Create `WorkspaceStateService` class
2. Define workspace state schema
3. Implement state storage (Redis + Supabase)
4. Add state change subscriptions
5. Implement state persistence
6. Add state validation
7. Write unit tests

**Estimated Effort**: 4-5 days

---

### Phase 2 Deliverables

- ✅ Agent outputs trigger SDUI updates
- ✅ Workflow transitions update UI automatically
- ✅ Server-side state management implemented
- ✅ Real-time state sync working
- ✅ Integration tests passing

**Total Phase 2 Effort**: 11-14 days (2 weeks)

---

## Phase 3: Advanced Features (Weeks 5-6)

### Objective
Implement advanced SDUI features for governance, atomic updates, and real-time collaboration.

### 3.1 Manifesto Rules Enforcement

**Purpose**: Enforce Manifesto rules at the Action Router level.

**Implementation**:
1. Integrate Manifesto Rules Engine with Action Router
2. Add pre-action validation
3. Generate integrity warnings in SDUI
4. Show IntegrityReviewPanel when violations detected
5. Add rule override workflow for authorized users

**Estimated Effort**: 3-4 days

---

### 3.2 Atomic UI Actions

**Purpose**: Enable surgical UI updates without full page regeneration.

**Implementation**:
1. Integrate ComponentMutationService with Action Router
2. Add atomic action handlers
3. Implement optimistic UI updates
4. Add rollback on action failure
5. Test all atomic action types

**Estimated Effort**: 3-4 days

---

### 3.3 Real-Time Updates

**Purpose**: Push SDUI updates to clients in real-time.

**Implementation**:
1. Set up WebSocket connection
2. Implement server-side push mechanism
3. Add client-side update handler
4. Handle concurrent updates
5. Add conflict resolution

**Estimated Effort**: 4-5 days

---

### Phase 3 Deliverables

- ✅ Manifesto rules enforced on all actions
- ✅ Atomic UI actions working
- ✅ Real-time updates implemented
- ✅ Optimistic UI updates with rollback
- ✅ Performance benchmarks met

**Total Phase 3 Effort**: 10-13 days (2 weeks)

---

## Phase 4: Migration & Optimization (Weeks 7-8)

### Objective
Migrate existing views to SDUI and optimize performance.

### 4.1 View Migration

**Views to Migrate**:
1. OpportunityWorkspace → SDUI (use sof-opportunity-template)
2. TargetROIWorkspace → SDUI (use sof-target-template)
3. ExpansionInsightPage → SDUI (use sof-expansion-template)
4. IntegrityCompliancePage → SDUI (use sof-integrity-template)
5. PerformanceDashboard → SDUI (create new template)

**Migration Process per View**:
1. Analyze current view structure
2. Map components to SDUI registry
3. Create/update SDUI template
4. Implement data fetching in Canvas Schema Service
5. Add action handlers in Action Router
6. Test end-to-end
7. Remove old React component

**Estimated Effort**: 2 days per view = 10 days

---

### 4.2 Performance Optimization

**Optimizations**:
1. Schema caching strategy
2. Data hydration optimization
3. Component lazy loading
4. Bundle size reduction
5. Server-side rendering (SSR) for initial load

**Estimated Effort**: 3-4 days

---

### 4.3 Documentation & Training

**Documentation**:
1. Update architecture documentation
2. Create SDUI developer guide
3. Document canonical actions
4. Create component authoring guide
5. Add troubleshooting guide

**Estimated Effort**: 2-3 days

---

### Phase 4 Deliverables

- ✅ All views migrated to SDUI
- ✅ Traditional React views removed
- ✅ Performance optimized
- ✅ Documentation complete
- ✅ Team trained on SDUI architecture

**Total Phase 4 Effort**: 15-17 days (2 weeks)

---

## Implementation Timeline

```
Week 1-2: Phase 1 - Core Integration
├── Canvas Schema Service (3-4 days)
├── Action Router (4-5 days)
└── SDUI App Integration (3-4 days)

Week 3-4: Phase 2 - Agent Integration
├── Agent Output → SDUI Pipeline (4-5 days)
├── Workflow → SDUI Integration (3-4 days)
└── Server-Side State Management (4-5 days)

Week 5-6: Phase 3 - Advanced Features
├── Manifesto Rules Enforcement (3-4 days)
├── Atomic UI Actions (3-4 days)
└── Real-Time Updates (4-5 days)

Week 7-8: Phase 4 - Migration & Optimization
├── View Migration (10 days)
├── Performance Optimization (3-4 days)
└── Documentation & Training (2-3 days)
```

**Total Estimated Effort**: 46-57 days (6-8 weeks)

---

## Success Criteria

### Phase 1
- [ ] Canvas Schema Service generates valid SDUI schemas
- [ ] Action Router routes all canonical actions
- [ ] App.tsx renders SDUI schemas
- [ ] Basic action → UI update flow works

### Phase 2
- [ ] Agent outputs trigger UI updates
- [ ] Workflow transitions update UI
- [ ] Server-side state persists correctly
- [ ] State syncs to client in real-time

### Phase 3
- [ ] Manifesto rules block invalid actions
- [ ] Atomic UI actions update components surgically
- [ ] Real-time updates push to all clients
- [ ] Performance benchmarks met (< 100ms action latency)

### Phase 4
- [ ] All views migrated to SDUI
- [ ] No traditional React views remain
- [ ] Bundle size reduced by 20%
- [ ] Documentation complete

---

## Risk Mitigation

### Risk: Breaking Existing Functionality
**Mitigation**: 
- Implement feature flags for SDUI vs. traditional views
- Run both systems in parallel during migration
- Comprehensive integration tests

### Risk: Performance Degradation
**Mitigation**:
- Benchmark at each phase
- Implement caching aggressively
- Use atomic updates instead of full regeneration

### Risk: Complex State Management
**Mitigation**:
- Start with simple state schema
- Use existing patterns from Workflow Orchestrator
- Implement state versioning for debugging

### Risk: Agent Integration Complexity
**Mitigation**:
- Start with one agent (CoordinatorAgent)
- Create adapter pattern for easy extension
- Document agent output → SDUI mapping clearly

---

## Dependencies

### External Dependencies
- Supabase (database, real-time subscriptions)
- Redis (caching)
- WebSocket server (real-time updates)

### Internal Dependencies
- SDUI Runtime Engine (existing)
- Component Registry (existing)
- Agent Fabric (existing)
- Workflow Orchestrator (existing)
- Manifesto Rules Engine (existing)

---

## Team Requirements

### Roles Needed
- **Backend Engineer**: Canvas Schema Service, Action Router, state management
- **Frontend Engineer**: SDUI App integration, component migration
- **Full-Stack Engineer**: Agent integration, workflow integration
- **QA Engineer**: Integration testing, performance testing

### Estimated Team Size
- 2-3 engineers for 6-8 weeks

---

## Conclusion

This implementation plan provides a structured approach to achieving full SDUI capability in ValueCanvas. The phased approach allows for:

1. **Early validation** of core concepts (Phase 1)
2. **Incremental complexity** (Phases 2-3)
3. **Safe migration** (Phase 4)

By following this plan, ValueCanvas will transform from a hybrid architecture to a true server-driven UI system where:

- ✅ Server controls all UI composition
- ✅ Agents automatically update UI
- ✅ Manifesto rules are enforced
- ✅ Workflows drive UI transitions
- ✅ Real-time collaboration works seamlessly

**Next Steps**: Review this plan with the team, adjust timelines based on priorities, and begin Phase 1 implementation.

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-27  
**Author**: Ona (AI Software Engineering Agent)
