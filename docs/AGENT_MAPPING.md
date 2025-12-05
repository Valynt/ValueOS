# Agent Mapping & Identity Document

**Task ID:** #004  
**Date:** December 5, 2025  
**Status:** ✅ Complete  
**Owner:** Autonomous Execution System

---

## Agent Name Consolidation

### Current State → Target State

| Old Name (Code) | New Name (Documentation) | File Location | Status |
|----------------|--------------------------|---------------|--------|
| OutcomeEngineerAgent | OpportunityAgent | `src/agents/` | Pending Rename |
| InterventionDesignerAgent | TargetAgent | `src/agents/` | Pending Rename |
| RealizationLoopAgent | RealizationAgent | `src/agents/` | Pending Rename |
| ValueEvalAgent | IntegrityAgent | `src/agents/` | Pending Rename |
| SystemMapperAgent | *[TO BE REMOVED]* | `src/agents/` | Pending Removal |
| CoordinatorAgent | CoordinatorAgent | `src/agents/` | ✅ Keep As-Is |
| CommunicatorAgent | CommunicatorAgent | `src/agents/` | ✅ Keep As-Is |
| *[NEW]* | ExpansionAgent | `src/lib/agent-fabric/agents/` | Pending Creation |

---

## Detailed Agent Responsibilities

### 1. CoordinatorAgent ✅ (No Change)
**Purpose:** Master orchestrator for all multi-agent workflows  
**Location:** `src/agents/CoordinatorAgent.ts`  
**Key Responsibilities:**
- Route user requests to appropriate specialist agents
- Manage agent workflow state
- Handle agent-to-agent communication
- Coordinate multi-step value discovery processes

**Integration Points:**
- AgentOrchestrator
- AgentFabric
- All specialist agents

---

### 2. CommunicatorAgent ✅ (No Change)
**Purpose:** User interaction and natural language interface  
**Location:** `src/agents/CommunicatorAgent.ts`  
**Key Responsibilities:**
- Parse user intents
- Generate natural language responses
- Handle conversational context
- Manage chat session state

**Integration Points:**
- User interface components
- CoordinatorAgent
- AgentChatService

---

### 3. OpportunityAgent (Rename from OutcomeEngineerAgent)
**Purpose:** Identify and analyze value opportunities  
**Location:** `src/agents/OpportunityAgent.ts`  
**Rename Tasks:**
- File: `OutcomeEngineerAgent.ts` → `OpportunityAgent.ts`
- Class: `OutcomeEngineerAgent` → `OpportunityAgent`
- Test file: `OutcomeEngineerAgent.test.ts` → `OpportunityAgent.test.ts`
- All imports across codebase

**Key Responsibilities:**
- Discover value creation opportunities
- Analyze stakeholder outcomes
- Map opportunity to business context
- Generate opportunity hypotheses

**Integration Points:**
- TargetAgent
- ExpansionAgent
- Value discovery workflows

---

### 4. TargetAgent (Rename from InterventionDesignerAgent)
**Purpose:** Design targeted interventions to realize value  
**Location:** `src/agents/TargetAgent.ts`  
**Rename Tasks:**
- File: `InterventionDesignerAgent.ts` → `TargetAgent.ts`
- Class: `InterventionDesignerAgent` → `TargetAgent`
- Test file: `InterventionDesignerAgent.test.ts` → `TargetAgent.test.ts`
- All imports across codebase

**Key Responsibilities:**
- Design value interventions
- Create actionable strategies
- Map targets to opportunities
- Validate intervention feasibility

**Integration Points:**
- OpportunityAgent
- RealizationAgent
- Intervention workflow orchestration

---

### 5. RealizationAgent (Rename from RealizationLoopAgent)
**Purpose:** Track and measure value realization  
**Location:** `src/agents/RealizationAgent.ts`  
**Rename Tasks:**
- File: `RealizationLoopAgent.ts` → `RealizationAgent.ts`
- Class: `RealizationLoopAgent` → `RealizationAgent`
- Test file: `RealizationLoopAgent.test.ts` → `RealizationAgent.test.ts`
- All imports across codebase

**Key Responsibilities:**
- Monitor value metrics
- Track realization progress
- Measure outcome achievement
- Generate progress reports

**Integration Points:**
- ValueMetricsTracker
- IntegrityAgent
- Dashboard components

---

### 6. IntegrityAgent (Rename from ValueEvalAgent)
**Purpose:** Validate and ensure value integrity  
**Location:** `src/agents/IntegrityAgent.ts`  
**Rename Tasks:**
- File: `ValueEvalAgent.ts` → `IntegrityAgent.ts`
- Class: `ValueEvalAgent` → `IntegrityAgent`
- Test file: `ValueEvalAgent.test.ts` → `IntegrityAgent.test.ts`
- All imports across codebase

**Key Responsibilities:**
- Validate value claims
- Ensure data integrity
- Audit value calculations
- Flag inconsistencies

**Integration Points:**
- RealizationAgent
- All value calculation workflows
- Audit logging systems

---

### 7. ExpansionAgent (NEW - To Be Created)
**Purpose:** Identify upsell, cross-sell, and growth opportunities  
**Location:** `src/lib/agent-fabric/agents/ExpansionAgent.ts`  
**Creation Tasks:**
- Create new agent class extending BaseAgent
- Implement expansion opportunity detection
- Create test suite
- Integrate with AgentFabric registry

**Key Responsibilities:**
- Identify expansion opportunities
- Analyze customer growth potential
- Suggest cross-sell/upsell strategies
- Track expansion metrics

**Integration Points:**
- OpportunityAgent
- ValueMetricsTracker
- Customer intelligence systems

---

### 8. SystemMapperAgent ❌ (TO BE REMOVED)
**Status:** Deprecated - Functionality absorbed into CoordinatorAgent  
**Removal Tasks:**
- Remove `src/agents/SystemMapperAgent.ts`
- Remove test file
- Update all imports to use CoordinatorAgent
- Migrate any unique functionality to CoordinatorAgent

**Rationale:** SystemMapperAgent's responsibilities overlap significantly with CoordinatorAgent. Consolidating reduces complexity and improves maintainability.

---

## Migration Strategy

### Phase 1: Preparation (Tasks #005-006)
1. Create this mapping document ✅
2. Create ExpansionAgent skeleton
3. Update import maps in tsconfig
4. Prepare test infrastructure

### Phase 2: File Renames (Task #005)
1. Rename OutcomeEngineerAgent → OpportunityAgent
2. Rename InterventionDesignerAgent → TargetAgent
3. Update class names internally
4. Run typecheck to identify broken imports

### Phase 3: Import Updates (Task #006)
1. Update all import statements
2. Update test files
3. Update documentation references
4. Update component integrations

### Phase 4: Remove SystemMapperAgent (Task #007)
1. Audit SystemMapperAgent functionality
2. Migrate unique features to CoordinatorAgent
3. Remove SystemMapperAgent file
4. Update all references

### Phase 5: Create ExpansionAgent (Task #007)
1. Implement ExpansionAgent class
2. Create comprehensive tests
3. Register in AgentFabric
4. Document integration points

### Phase 6: Validation
1. Run full test suite
2. Execute typecheck
3. Test agent workflows end-to-end
4. Update all documentation

---

## Impact Analysis

### Files to Update (Auto-detected via grep)

**Agent Files:**
- `src/agents/*.ts` (7 files)
- `src/lib/agent-fabric/agents/*.ts` (10 files)
- `src/agents/__tests__/*.test.ts` (6 files)
- `src/lib/agent-fabric/agents/__tests__/*.test.ts` (3 files)

**Service Files:**
- `src/services/AgentOrchestrator.ts`
- `src/services/AgentFabricService.ts`
- `src/services/AgentRegistry.ts`
- `src/services/AgentRoutingLayer.ts`
- `src/services/AgentIntentConverter.ts`

**Component Files:**
- `src/components/Agent/*.tsx`
- `src/components/SDUI/AgentResponseCard.tsx`
- `src/components/SDUI/AgentWorkflowPanel.tsx`

**Documentation:**
- `docs/**/*.md` (all agent references)
- `README.md`
- `CONTRIBUTING.md`

---

## Testing Strategy

### Unit Tests
- All renamed agents must have passing unit tests
- ExpansionAgent must have >80% coverage
- SystemMapperAgent tests migrated or removed

### Integration Tests
- Agent orchestration workflows
- Multi-agent coordination scenarios
- SDUI integration with renamed agents

### E2E Tests
- Complete user workflows with new agent names
- Agent handoff scenarios
- Error handling and fallbacks

---

## Acceptance Criteria

- [ ] All 4 agents renamed successfully
- [ ] SystemMapperAgent removed, functionality migrated
- [ ] ExpansionAgent created and tested
- [ ] All imports updated
- [ ] All tests passing
- [ ] Documentation updated
- [ ] TypeScript compilation successful
- [ ] No console errors in dev environment
- [ ] E2E workflows functional

---

## Timeline

- **Task #004:** Agent Mapping Document ✅ (30 minutes)
- **Task #005:** File Renames (2 hours)
- **Task #006:** Import Updates (2 hours)
- **Task #007:** ExpansionAgent Creation + SystemMapperAgent Removal (4 hours)

**Total Effort:** ~8.5 hours  
**Status:** In Progress
