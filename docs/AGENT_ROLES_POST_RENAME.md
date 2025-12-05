# Agent Roles & Responsibilities (Post-Rename)
## EPIC 5: Roles Realignment Documentation

**Version:** 2.0 (Post Identity Consolidation)  
**Last Updated:** December 5, 2025

---

## Overview

This document defines the updated roles and responsibilities of all agents in the ValueCanvas system following the EPIC 1 identity consolidation and agent renaming initiative.

---

## Agent Taxonomy

### Primary Value Lifecycle Agents

These agents map directly to the value lifecycle stages:

1. **OpportunityAgent** (formerly OutcomeEngineerAgent)
2. **TargetAgent** (formerly InterventionDesignerAgent)
3. **RealizationAgent** (formerly RealizationLoopAgent)
4. **ExpansionAgent** (new in this release)

### Support & Governance Agents

5. **IntegrityAgent** (formerly ValueEvalAgent)
6. **CommunicatorAgent** (no change)
7. **CoordinatorAgent** (no change)

### Deprecated Agents

8. **SystemMapperAgent** (deprecated, functionality absorbed by CoordinatorAgent)

---

## Detailed Agent Specifications

### 1. OpportunityAgent

**Former Name:** OutcomeEngineerAgent  
**File:** `/src/agents/OpportunityAgent.ts`  
**Agent ID:** `opportunity-v1`

**Purpose:**
Identifies and analyzes value opportunities by building systemic outcome hypotheses that bridge system changes to KPI deltas and value stories.

**Stage:** Opportunity (Value Lifecycle Stage 1)

**Responsibilities:**
- Analyze business context and identify value opportunities
- Build outcome hypotheses linking interventions to KPIs
- Generate causal pathway models
- Assess confidence levels and assumptions
- Create SDUI layouts for opportunity visualization

**Key Methods:**
```typescript
async analyze(input: OpportunityInput): Promise<OpportunityOutput>
```

**Input:**
- Organization ID
- System map
- Intervention points
- KPIs (current, target)
- Industry context

**Output:**
- Outcome hypotheses
- SDUI layout (OutcomeEngineeringPage)
- Insights (causal pathways, assumptions, validation approach)
- Confidence scores

**Dependencies:**
- CoordinatorAgent (receives tasks from)
- IntegrityAgent (validated by)
- CommunicatorAgent (presents via)

**Memory Usage:**
- Stores successful hypotheses patterns
- Learns from feedback on accuracy
- Caches industry-specific knowledge

**Renamed From:** OutcomeEngineerAgent  
**Rationale:** "Opportunity" better reflects the stage and user-facing terminology

---

### 2. TargetAgent

**Former Name:** InterventionDesignerAgent  
**File:** `/src/agents/TargetAgent.ts`  
**Agent ID:** `target-v1`

**Purpose:**
Designs targeted interventions from system maps and connects them to KPIs and value models.

**Stage:** Target (Value Lifecycle Stage 2)

**Responsibilities:**
- Design specific interventions for identified opportunities
- Map interventions to measurable KPIs
- Build business case and ROI models
- Identify implementation dependencies
- Generate SDUI layouts for intervention design

**Key Methods:**
```typescript
async design(input: TargetInput): Promise<TargetOutput>
```

**Input:**
- Opportunity hypotheses (from OpportunityAgent)
- System map
- Available interventions
- Resource constraints
- Timeline requirements

**Output:**
- Intervention designs
- KPI mappings
- Business case / ROI model
- SDUI layout (InterventionDesignPage)
- Implementation plan

**Dependencies:**
- OpportunityAgent (consumes output from)
- IntegrityAgent (validated by)
- RealizationAgent (passes work to)

**Memory Usage:**
- Stores effective intervention patterns
- Learns from implementation success rates
- Caches ROI calculation models

**Renamed From:** InterventionDesignerAgent  
**Rationale:** "Target" aligns with value lifecycle stage terminology and is more concise

---

### 3. RealizationAgent

**Former Name:** RealizationLoopAgent  
**File:** `/src/agents/RealizationAgent.ts`  
**Agent ID:** `realization-v1`

**Purpose:**
Tracks feedback loops and behavior changes during value realization phase. Monitors Realization → Behavior Change → System Update cycles.

**Stage:** Realization (Value Lifecycle Stage 3)

**Responsibilities:**
- Track intervention implementation progress
- Monitor KPI achievement vs. targets
- Identify feedback loops (positive and negative)
- Detect behavior changes
- Trigger corrective actions
- Generate SDUI layouts for realization monitoring

**Key Methods:**
```typescript
async track(input: RealizationInput): Promise<RealizationOutput>
```

**Input:**
- Intervention plan (from TargetAgent)
- Current KPI values
- Baseline measurements
- Feedback loop definitions

**Output:**
- Realization status
- KPI progress tracking
- Feedback loop analysis
- Behavior change detection
- SDUI layout (RealizationMonitoringPage)
- Recommendations for adjustment

**Dependencies:**
- TargetAgent (consumes output from)
- ExpansionAgent (feeds into)
- IntegrityAgent (monitored by)

**Memory Usage:**
- Stores KPI baselines and targets
- Learns from realization patterns
- Caches successful feedback loop models

**Renamed From:** RealizationLoopAgent  
**Rationale:** Simplified name, dropped "Loop" while retaining focus on feedback cycles

---

### 4. ExpansionAgent

**File:** `/src/lib/agent-fabric/agents/ExpansionAgent.ts`  
**Agent ID:** `expansion-v1`  
**Status:** ✅ Exists (verified in EPIC 1)

**Purpose:**
Identifies upsell and cross-sell opportunities based on realized value.

**Stage:** Expansion (Value Lifecycle Stage 4)

**Responsibilities:**
- Analyze value delivered to date
- Identify customer readiness indicators
- Map adjacent opportunities
- Quantify expansion value potential
- Generate expansion recommendations
- Create SDUI layouts for expansion opportunities

**Key Methods:**
```typescript
async identifyOpportunities(input: ExpansionInput): Promise<ExpansionOutput>
```

**Input:**
- Realized value metrics (from RealizationAgent)
- Customer usage patterns
- Available products/features
- Customer maturity signals

**Output:**
- Expansion opportunities (upsell, cross-sell)
- Value quantification
- Readiness assessment
- Recommended approach
- SDUI layout (ExpansionOpportunitiesPage)

**Dependencies:**
- RealizationAgent (consumes output from)
- OpportunityAgent (feeds back into for new cycles)
- IntegrityAgent (validated by)

**Memory Usage:**
- Stores successful expansion patterns
- Learns customer maturity indicators
- Caches product adjacency models

**Status:** New agent, no rename required

---

### 5. IntegrityAgent

**Former Name:** ValueEvalAgent  
**File:** `/src/agents/IntegrityAgent.ts`  
**Agent ID:** `integrity-v1`

**Purpose:**
Evaluates artifact quality and integrity across all agents. Scores completeness, accuracy, usefulness. Generates improvement recommendations.

**Stage:** Cross-cutting (applies to all stages)

**Responsibilities:**
- Validate agent outputs for quality
- Score completeness, accuracy, usefulness
- Identify gaps and inconsistencies
- Generate improvement recommendations
- Support reinforcement learning feedback
- Create SDUI layouts for quality reports

**Key Methods:**
```typescript
async evaluate(input: IntegrityInput): Promise<IntegrityOutput>
```

**Input:**
- Artifact to evaluate (any agent output)
- Evaluation criteria
- Context (user, organization, stage)

**Output:**
- Quality scores (completeness, accuracy, usefulness)
- Gap analysis
- Improvement recommendations
- SDUI layout (QualityReportPage)
- Validation status

**Dependencies:**
- Called by all other agents
- Provides feedback to agent memory systems
- Coordinates with CoordinatorAgent for quality gates

**Memory Usage:**
- Stores quality standards by artifact type
- Learns from user feedback on quality
- Caches evaluation criteria

**Renamed From:** ValueEvalAgent  
**Rationale:** "Integrity" better conveys the artifact validation role

---

### 6. CommunicatorAgent

**File:** `/src/agents/CommunicatorAgent.ts`  
**Agent ID:** `communicator-v1`  
**Status:** No rename

**Purpose:**
Handles stakeholder communication, presentation formatting, and messaging.

**Stage:** Cross-cutting (applies to all stages)

**Responsibilities:**
- Format agent outputs for stakeholder consumption
- Generate executive summaries
- Create presentation-ready materials
- Adapt messaging to audience (technical, business, executive)
- Handle multi-language support
- Generate SDUI layouts for communication

**Key Methods:**
```typescript
async communicate(input: CommunicatorInput): Promise<CommunicatorOutput>
```

**Input:**
- Content to communicate (any agent output)
- Target audience
- Communication goal
- Format preferences

**Output:**
- Formatted communication
- Stakeholder-specific messaging
- SDUI layout (customized by audience)
- Presentation materials

**Dependencies:**
- Receives output from all value lifecycle agents
- Integrates with email/Slack for delivery
- Coordinates with IntegrityAgent for message quality

**Memory Usage:**
- Stores audience preferences
- Learns effective messaging patterns
- Caches communication templates

**Status:** No change from v1.0

---

### 7. CoordinatorAgent

**File:** `/src/agents/CoordinatorAgent.ts`  
**Agent ID:** `coordinator-v1`  
**Status:** Enhanced (absorbed SystemMapperAgent functionality)

**Purpose:**
Master task coordinator. Breaks high-level intents into subgoals, routes to appropriate agents, generates SDUI layouts, logs all decisions.

**Stage:** Cross-cutting (orchestrates all agents)

**Responsibilities:**
- Decompose user intents into executable subgoals
- Route subgoals to specialized agents
- Manage dependencies and execution order
- Generate SDUI layout directives
- Coordinate multi-agent workflows
- Audit log all decisions
- **NEW:** Perform system mapping (absorbed from SystemMapperAgent)

**Key Methods:**
```typescript
async planTask(intent: CreateTaskIntent): Promise<TaskPlan>
async executeTask(plan: TaskPlan): Promise<TaskExecution>
async generateSDUILayout(subgoal: Subgoal): Promise<SDUIPageDefinition>
```

**Input:**
- User intent
- Context (user, organization, current state)
- Available agents

**Output:**
- Task plan (subgoals, routing, execution order)
- SDUI layout directives
- Execution results
- Audit logs

**Dependencies:**
- Orchestrates all other agents
- Integrates with WorkflowOrchestrator
- Coordinates with IntegrityAgent for quality gates

**Enhanced Responsibilities (Post SystemMapperAgent Deprecation):**
- Analyze system context and create system maps
- Identify leverage points
- Map causal relationships
- Generate system visualizations

**Memory Usage:**
- Stores task decomposition patterns
- Learns optimal routing strategies
- Caches system mapping models

**Status:** Enhanced, absorbed SystemMapperAgent capabilities

---

### 8. SystemMapperAgent (DEPRECATED)

**File:** `/src/agents/SystemMapperAgent.ts`  
**Agent ID:** `system-mapper-v1`  
**Status:** ⚠️ DEPRECATED

**Deprecation Notice:**
```typescript
/**
 * @deprecated This agent's functionality has been integrated into CoordinatorAgent.
 * Please use CoordinatorAgent for system mapping tasks.
 * This file will be removed in a future release.
 */
```

**Former Purpose:**
Performed systems analysis using discovery data to create system maps with leverage points.

**Migration Path:**
All system mapping functionality now handled by **CoordinatorAgent**.

**Affected Code:**
- Imports of `SystemMapperAgent` should be updated to `CoordinatorAgent`
- Calls to `systemMapperAgent.map()` should use `coordinatorAgent.planTask()` with system mapping intent

**Removal Timeline:** Planned for v1.1.0 (Q1 2026)

---

## Agent Interaction Patterns

### Sequential Flow (Happy Path)

```
User Intent
    ↓
CoordinatorAgent (decompose + route)
    ↓
OpportunityAgent (identify opportunities)
    ↓
TargetAgent (design interventions)
    ↓
RealizationAgent (track implementation)
    ↓
ExpansionAgent (identify next opportunities)
    ↓
[Loop back to OpportunityAgent]
```

### Cross-Cutting Flows

**Quality Assurance:**
```
Any Agent → IntegrityAgent → Validation Report → Agent (refine if needed)
```

**Communication:**
```
Any Agent → CommunicatorAgent → Stakeholder-Ready Output → User
```

**Coordination:**
```
User → CoordinatorAgent → [Routes to appropriate agent] → CoordinatorAgent → User
```

---

## Agent Memory & Learning

All agents leverage the **Agent Memory System** for long-term learning:

### Memory Types by Agent

| Agent | Stores | Uses For |
|-------|--------|----------|
| OpportunityAgent | Hypothesis patterns, causal models | Faster opportunity identification |
| TargetAgent | Intervention designs, ROI models | Better intervention recommendations |
| RealizationAgent | KPI baselines, feedback loops | Improved realization tracking |
| ExpansionAgent | Expansion patterns, maturity signals | Higher conversion upsells |
| IntegrityAgent | Quality criteria, evaluation models | Consistent quality standards |
| CommunicatorAgent | Messaging patterns, audience preferences | Tailored communication |
| CoordinatorAgent | Task patterns, routing strategies | Optimal agent selection |

### Confidence Scoring

All agents participate in confidence feedback:
- User feedback (positive/negative) → Confidence adjustment
- IntegrityAgent validation → Confidence boost/penalty
- Realization outcomes → Historical accuracy learning

---

## Naming Convention Mapping

| Old Name | New Name | File Path | Rationale |
|----------|----------|-----------|-----------|
| OutcomeEngineerAgent | OpportunityAgent | `/src/agents/OpportunityAgent.ts` | Aligns with "Opportunity" stage |
| InterventionDesignerAgent | TargetAgent | `/src/agents/TargetAgent.ts` | Aligns with "Target" stage |
| RealizationLoopAgent | RealizationAgent | `/src/agents/RealizationAgent.ts` | Simplified, still conveys feedback tracking |
| ValueEvalAgent | IntegrityAgent | `/src/agents/IntegrityAgent.ts` | "Integrity" better describes validation role |
| SystemMapperAgent | (deprecated) | `/src/agents/SystemMapperAgent.ts` | Functionality absorbed by CoordinatorAgent |

---

## SDUI Output Conventions

Each agent generates SDUI layouts following these conventions:

### OpportunityAgent
- **Page Type:** `OutcomeEngineeringPage`
- **Primary Component:** `OpportunityCard`
- **Layout:** Dashboard (multi-hypothesis grid)

### TargetAgent
- **Page Type:** `InterventionDesignPage`
- **Primary Component:** `TargetCard`
- **Layout:** Two-column (design + metrics)

### RealizationAgent
- **Page Type:** `RealizationMonitoringPage`
- **Primary Component:** `RealizationDashboard`
- **Layout:** Dashboard (KPI tracking grid)

### ExpansionAgent
- **Page Type:** `ExpansionOpportunitiesPage`
- **Primary Component:** `ExpansionCard`
- **Layout:** Grid (opportunity cards)

### IntegrityAgent
- **Page Type:** `QualityReportPage`
- **Primary Component:** `QualityScorecard`
- **Layout:** Single-column (report format)

---

## API Contracts (Post-Rename)

All agent APIs follow this pattern:

```typescript
interface AgentInput {
  organizationId: string;
  userId: string;
  context: Record<string, any>;
  // Agent-specific fields
}

interface AgentOutput {
  result: any; // Agent-specific result
  sduiLayout: SDUIPageDefinition;
  confidence: number;
  metadata: {
    agentId: string;
    agentVersion: string;
    timestamp: string;
  };
}
```

---

## Migration Checklist (For Existing Code)

If you have code referencing old agent names:

- [ ] Replace `OutcomeEngineerAgent` → `OpportunityAgent`
- [ ] Replace `outcomeEngineerAgent` → `opportunityAgent`
- [ ] Replace `OutcomeEngineerInput` → `OpportunityInput`
- [ ] Replace `OutcomeEngineerOutput` → `OpportunityOutput`
- [ ] Replace `InterventionDesignerAgent` → `TargetAgent`
- [ ] Replace `interventionDesignerAgent` → `targetAgent`
- [ ] Replace `InterventionDesignerInput` → `TargetInput`
- [ ] Replace `InterventionDesignerOutput` → `TargetOutput`
- [ ] Replace `RealizationLoopAgent` → `RealizationAgent`
- [ ] Replace `realizationLoopAgent` → `realizationAgent`
- [ ] Replace `RealizationLoopInput` → `RealizationInput`
- [ ] Replace `RealizationLoopOutput` → `RealizationOutput`
- [ ] Replace `ValueEvalAgent` → `IntegrityAgent`
- [ ] Replace `valueEvalAgent` → `integrityAgent`
- [ ] Replace `ValueEvalInput` → `IntegrityInput`
- [ ] Replace `ValueEvalOutput` → `IntegrityOutput`
- [ ] Remove references to `SystemMapperAgent` → Use `CoordinatorAgent`

---

## Testing Strategy (Post-Rename)

Each agent has comprehensive test coverage:

- **Unit Tests:** `src/agents/__tests__/[AgentName].test.ts`
- **Integration Tests:** `src/sdui/__tests__/integration/agent-to-render.test.ts`
- **E2E Tests:** `tests/e2e/value-lifecycle.spec.ts`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-Q4 | Initial agent definitions |
| 2.0 | 2025-12-05 | Post-rename realignment, SystemMapperAgent deprecated |

---

**Document Owner:** AI/Agent Fabric Agent  
**Reviewers:** Engineering Agent, Conductor Agent  
**Last Review:** 2025-12-05  
**Next Review:** 2026-01-05
