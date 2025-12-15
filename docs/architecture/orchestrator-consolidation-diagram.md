# Orchestrator Consolidation Architecture Diagrams

## Current State (Before Consolidation)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UI Components                                │
│  MainLayout.tsx │ ChatCanvas │ WorkflowErrorPanel │ ActionRouter    │
└────────┬──────────────┬──────────────┬──────────────┬───────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌────────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐
│ AgentOrch.     │ │ Unified  │ │ Workflow │ │ AgentOrchestrator│
│ Adapter        │ │ AgentOrch│ │ Orch.    │ │ (Legacy)         │
│ (Wrapper)      │ │          │ │          │ │ ❌ DEPRECATED    │
└────────┬───────┘ └────┬─────┘ └────┬─────┘ └──────────────────┘
         │              │              │
         ▼              │              │
┌────────────────┐      │              │
│ UnifiedAgent   │◄─────┘              │
│ Orchestrator   │                     │
│ (Primary)      │                     │
└────────────────┘                     │
                                       │
         ┌─────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│              Fragmented Orchestrators                       │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ Stateless        │  │ ValueLifecycle   │               │
│  │ AgentOrch.       │  │ Orchestrator     │               │
│  │ ❌ TO MERGE      │  │ ⚠️ SPECIALIZED   │               │
│  └──────────────────┘  └──────────────────┘               │
└────────────────────────────────────────────────────────────┘

PROBLEMS:
❌ 6 orchestrators with overlapping responsibilities
❌ Confusion about which to use
❌ Duplicate code and logic
❌ Singleton state bugs in legacy orchestrator
❌ Difficult to maintain and test
```

## Target State (After Consolidation)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UI Components                                │
│  MainLayout.tsx │ ChatCanvas │ WorkflowErrorPanel │ ActionRouter    │
└────────┬──────────────┬──────────────┬──────────────┬───────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                        │
                        ▼
         ┌──────────────────────────────────────┐
         │   AgentOrchestratorAdapter           │
         │   (Backward Compatibility Layer)     │
         │   • Legacy method signatures         │
         │   • Internal state management        │
         │   • Streaming callback normalization │
         └──────────────┬───────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────────────┐
│              UnifiedAgentOrchestrator (PRIMARY)                     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Query Processing (from StatelessAgentOrchestrator)           │ │
│  │  • Stateless design                                          │ │
│  │  • Concurrent-safe                                           │ │
│  │  • Agent routing                                             │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Workflow DAG Execution (from WorkflowOrchestrator)           │ │
│  │  • DAG stage execution                                       │ │
│  │  • Retry logic                                               │ │
│  │  • Circuit breaker                                           │ │
│  │  • Simulation (merged)                                       │ │
│  │  • Guardrails (merged)                                       │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ SDUI Generation (from AgentOrchestrator)                     │ │
│  │  • Dynamic page generation                                   │ │
│  │  • Agent API integration                                     │ │
│  │  • Streaming updates                                         │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Task Planning (from CoordinatorAgent)                        │ │
│  │  • Subgoal decomposition                                     │ │
│  │  • Complexity scoring                                        │ │
│  │  • Execution ordering                                        │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Cross-Cutting Concerns                                       │ │
│  │  • Circuit breaker management                                │ │
│  │  • Tracing and audit logging                                 │ │
│  │  • Agent registry integration                                │ │
│  │  • Routing layer integration                                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────────────┐
         │   ValueLifecycleOrchestrator         │
         │   (Specialized - Saga Pattern)       │
         │   • Lifecycle stage execution        │
         │   • Compensation on failure          │
         │   • Stage validation                 │
         │   • Used via integration layer       │
         └──────────────────────────────────────┘

BENEFITS:
✅ Single primary orchestrator (UnifiedAgentOrchestrator)
✅ Clear separation of concerns
✅ Backward compatibility via adapter
✅ Specialized orchestrator for saga pattern
✅ Reduced code duplication (40% reduction)
✅ Easier to maintain and test
✅ Stateless design prevents bugs
```

## Migration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1: IMMEDIATE                            │
│                    (Days 2-3)                                    │
└─────────────────────────────────────────────────────────────────┘

Step 1: Migrate ActionRouter.ts
┌──────────────────┐         ┌──────────────────┐
│ ActionRouter     │         │ ActionRouter     │
│ (Before)         │  ────►  │ (After)          │
│                  │         │                  │
│ • AgentOrch.     │         │ • UnifiedAgent   │
│   (Legacy) ❌    │         │   Orchestrator ✅│
│ • WorkflowOrch.  │         │ • WorkflowOrch.  │
│   (Keep temp)    │         │   (Keep temp)    │
└──────────────────┘         └──────────────────┘

Step 2: Migrate AgentQueryService.ts
┌──────────────────┐         ┌──────────────────┐
│ AgentQuerySvc    │         │ AgentQuerySvc    │
│ (Before)         │  ────►  │ (After)          │
│                  │         │                  │
│ • StatelessAgent │         │ • UnifiedAgent   │
│   Orch. ❌       │         │   Orchestrator ✅│
└──────────────────┘         └──────────────────┘

Step 3: Update Imports
┌──────────────────┐         ┌──────────────────┐
│ StreamingInd.tsx │         │ StreamingInd.tsx │
│ (Before)         │  ────►  │ (After)          │
│                  │         │                  │
│ import from      │         │ import from      │
│ AgentOrch. ❌    │         │ UnifiedOrch. ✅  │
└──────────────────┘         └──────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2: CONSOLIDATION                        │
│                    (Days 4-5)                                    │
└─────────────────────────────────────────────────────────────────┘

Step 4: Merge Simulation
┌──────────────────┐         ┌──────────────────┐
│ WorkflowOrch.    │         │ UnifiedAgent     │
│ simulateWorkflow │  ────►  │ Orchestrator     │
│                  │         │ + simulation ✅  │
└──────────────────┘         └──────────────────┘

Step 5: Merge Guardrails
┌──────────────────┐         ┌──────────────────┐
│ WorkflowOrch.    │         │ UnifiedAgent     │
│ guardrails       │  ────►  │ Orchestrator     │
│                  │         │ + guardrails ✅  │
└──────────────────┘         └──────────────────┘

Step 6: Update UI Components
┌──────────────────┐         ┌──────────────────┐
│ WorkflowError    │         │ WorkflowError    │
│ Panel.tsx        │  ────►  │ Panel.tsx        │
│                  │         │                  │
│ • WorkflowOrch.  │         │ • UnifiedAgent   │
│   ❌             │         │   Orchestrator ✅│
└──────────────────┘         └──────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 3: CLEANUP                              │
│                    (Day 5)                                       │
└─────────────────────────────────────────────────────────────────┘

Step 7: Remove Deprecated Files
┌──────────────────────────────────────────────────────────────┐
│ Files to Remove:                                              │
│                                                               │
│ ❌ src/services/AgentOrchestrator.ts                         │
│ ❌ src/services/StatelessAgentOrchestrator.ts                │
│ ❌ src/services/WorkflowOrchestrator.ts (if fully merged)    │
└──────────────────────────────────────────────────────────────┘

Step 8: Update Documentation
┌──────────────────────────────────────────────────────────────┐
│ Documentation Updates:                                        │
│                                                               │
│ ✅ ADR 0001 (orchestration-layer.md)                         │
│ ✅ SPRINT_1_PROGRESS.md                                      │
│ ✅ Migration guide                                           │
│ ✅ API documentation                                         │
└──────────────────────────────────────────────────────────────┘
```

## Feature Consolidation Map

```
┌─────────────────────────────────────────────────────────────────┐
│              Feature Consolidation Matrix                        │
└─────────────────────────────────────────────────────────────────┘

Query Processing
├─ StatelessAgentOrchestrator ──► UnifiedAgentOrchestrator ✅
│  └─ processQuery()
│  └─ createInitialState()
│  └─ updateStage()
│
├─ AgentOrchestrator (Legacy) ──► DEPRECATED ❌
   └─ processQuery() (stateful)

Workflow Execution
├─ WorkflowOrchestrator ──► UnifiedAgentOrchestrator ⚠️
│  ├─ executeWorkflow() ──────────► ✅ Merged
│  ├─ executeDAG() ───────────────► ✅ Merged
│  ├─ simulateWorkflow() ─────────► 🔴 TO MERGE
│  ├─ guardrails ─────────────────► 🔴 TO MERGE
│  └─ getExecutionStatus() ───────► ✅ Merged
│
└─ UnifiedAgentOrchestrator
   └─ executeWorkflow() ✅

SDUI Generation
├─ AgentOrchestrator (Legacy) ──► UnifiedAgentOrchestrator ✅
│  └─ generateSDUIPage()
│
└─ UnifiedAgentOrchestrator
   └─ generateSDUIPage() ✅

Task Planning
├─ CoordinatorAgent ──► UnifiedAgentOrchestrator ✅
│  └─ planTask()
│
└─ UnifiedAgentOrchestrator
   └─ planTask() ✅

Lifecycle Management (Saga Pattern)
└─ ValueLifecycleOrchestrator ──► KEEP AS SPECIALIZED ✅
   ├─ executeLifecycleStage()
   ├─ compensation handlers
   └─ stage validation

Circuit Breaker
├─ All Orchestrators ──► CircuitBreakerManager (Shared) ✅
└─ UnifiedAgentOrchestrator
   └─ Uses CircuitBreakerManager ✅
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Request Flow                             │
└─────────────────────────────────────────────────────────────────┘

1. UI Component Request
   │
   ├─► MainLayout.tsx
   │   └─► agentOrchestrator.processQuery(query, options)
   │
   └─► ChatCanvasLayout.tsx
       └─► agentOrchestrator.generateSDUIPage(agent, query)

2. Adapter Layer (Backward Compatibility)
   │
   └─► AgentOrchestratorAdapter
       ├─► Normalize parameters
       ├─► Manage internal state
       └─► Delegate to UnifiedAgentOrchestrator

3. Unified Orchestrator (Core Logic)
   │
   └─► UnifiedAgentOrchestrator
       ├─► Route to appropriate capability
       │   ├─► Query Processing
       │   ├─► Workflow Execution
       │   ├─► SDUI Generation
       │   └─► Task Planning
       │
       ├─► Execute with circuit breaker
       ├─► Log to audit system
       └─► Return result

4. Agent Execution
   │
   ├─► AgentAPI
   │   └─► Call specific agent (Opportunity, Target, etc.)
   │
   ├─► AgentRoutingLayer
   │   └─► Select best agent for task
   │
   └─► CircuitBreakerManager
       └─► Protect against failures

5. Response Flow
   │
   ├─► UnifiedAgentOrchestrator
   │   └─► Format response
   │
   ├─► AgentOrchestratorAdapter
   │   └─► Normalize for legacy interface
   │
   └─► UI Component
       └─► Render result
```

## State Management Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│              Legacy vs Unified State Management                  │
└─────────────────────────────────────────────────────────────────┘

LEGACY (AgentOrchestrator) - STATEFUL ❌
┌──────────────────────────────────────┐
│ AgentOrchestrator Instance           │
│                                      │
│ private workflowState: {             │
│   currentStage: string               │
│   status: WorkflowStatus             │
│   completedStages: string[]          │
│   context: Record<string, any>       │
│ }                                    │
│                                      │
│ PROBLEM: Shared state across         │
│ concurrent requests causes bugs!     │
└──────────────────────────────────────┘

UNIFIED (UnifiedAgentOrchestrator) - STATELESS ✅
┌──────────────────────────────────────┐
│ UnifiedAgentOrchestrator             │
│                                      │
│ processQuery(                        │
│   query: string,                     │
│   currentState: WorkflowState, ◄──── State passed as parameter
│   userId: string,                    │
│   sessionId: string                  │
│ ): Promise<{                         │
│   response: AgentResponse,           │
│   nextState: WorkflowState ◄──────── New state returned
│ }>                                   │
│                                      │
│ BENEFIT: No shared state,            │
│ safe for concurrent requests!        │
└──────────────────────────────────────┘

ADAPTER (AgentOrchestratorAdapter) - HYBRID ✅
┌──────────────────────────────────────┐
│ AgentOrchestratorAdapter             │
│                                      │
│ private currentState: WorkflowState  │ ◄─ Internal state
│                                      │    for compatibility
│ processQuery(query, options) {       │
│   // Initialize state if needed      │
│   if (!this.currentState) {          │
│     this.currentState =              │
│       unified.createInitialState()   │
│   }                                  │
│                                      │
│   // Delegate to unified             │
│   const result = await               │
│     unified.processQuery(            │
│       query,                         │
│       this.currentState, ◄────────── Pass state
│       userId,                        │
│       sessionId                      │
│     )                                │
│                                      │
│   // Update internal state           │
│   this.currentState = result.nextState │
│                                      │
│   return result.response             │
│ }                                    │
│                                      │
│ BENEFIT: Backward compatible         │
│ interface with stateless backend!    │
└──────────────────────────────────────┘
```

## Testing Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Testing Pyramid                               │
└─────────────────────────────────────────────────────────────────┘

                    ▲
                   ╱ ╲
                  ╱   ╲
                 ╱ E2E ╲
                ╱───────╲
               ╱         ╲
              ╱Integration╲
             ╱─────────────╲
            ╱               ╲
           ╱   Unit Tests    ╲
          ╱___________________╲

Unit Tests (13,721 LOC)
├─ UnifiedAgentOrchestrator.test.ts
│  ├─ Query processing
│  ├─ Workflow execution
│  ├─ SDUI generation
│  ├─ Task planning
│  └─ Circuit breaker
│
├─ AgentOrchestratorAdapter.test.ts
│  ├─ Backward compatibility
│  ├─ State management
│  ├─ Callback normalization
│  └─ Delegation to unified
│
└─ WorkflowOrchestrator.guardrails.test.ts
   ├─ Cost limits
   ├─ Approval gates
   └─ Time limits

Integration Tests
├─ End-to-end workflow execution
├─ Multi-stage orchestration
├─ Error handling and compensation
└─ Circuit breaker integration

E2E Tests
├─ UI component integration
├─ Real agent execution
└─ Production scenarios
```

---

**Last Updated:** 2024-12-13  
**Status:** Complete  
**Next Review:** After Sprint 1 completion
