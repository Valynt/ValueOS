# Agent Fabric & Agent Guide

**Last Updated:** December 5, 2025  
**Version:** 1.0.0

Consolidated reference for agents and the Agent Fabric, derived from:

- `AGENT_ROLES_POST_RENAME.md`
- `AGENT_MAPPING.md`
- `AGENT_NAMING_MAPPING.md`
- `AGENT_CONSOLIDATION.md`
- `AGENT_TRACING_GUIDE.md`
- `AGENT_FABRIC_IMPLEMENTATION_COMPLETE.md` (superseded)
- Related architecture + rules + tool docs

---

## 1. Agent Fabric Overview

The Agent Fabric is a **multi-agent system** that powers the ValueCanvas value lifecycle:

> **Opportunity → Target → Realization → Expansion**, with cross-cutting agents for integrity, communication, and coordination.

Key design goals:

- Clear, stable **agent responsibilities** mapped to the value lifecycle.
- Unified **BaseAgent** with LLM, memory, safety, and tracing wired in.
- **CoordinatorAgent** as the orchestrator for multi-agent workflows.
- Fully instrumented, **rules-aware** and **tool-aware** execution.

High-level flow:

1. User intent enters via chat or SDUI action.
2. CoordinatorAgent plans work and routes to specialist agents.
3. Agents call tools, memory, and LLMs, and emit SDUI pages.
4. SDUI is rendered with dynamic bindings and partial mutations.
5. Rules framework and circuit breakers enforce safety and cost control.

---

## 2. Agent Taxonomy (Post-Rename)

### 2.1 Primary Lifecycle Agents

These map 1:1 to value lifecycle stages.

| Stage       | Agent             | Former Name               | File                                      |
|------------|-------------------|---------------------------|-------------------------------------------|
| Opportunity | `OpportunityAgent` | `OutcomeEngineerAgent`    | `src/agents/OpportunityAgent.ts`         |
| Target      | `TargetAgent`     | `InterventionDesignerAgent` | `src/agents/TargetAgent.ts`            |
| Realization | `RealizationAgent`| `RealizationLoopAgent`    | `src/agents/RealizationAgent.ts`        |
| Expansion   | `ExpansionAgent`  | (new)                     | `src/lib/agent-fabric/agents/ExpansionAgent.ts` |

### 2.2 Support & Governance Agents

| Agent            | Former Name      | Purpose                                      |
|------------------|------------------|----------------------------------------------|
| `IntegrityAgent` | `ValueEvalAgent` | Quality & integrity checks on artifacts      |
| `CommunicatorAgent` | (unchanged)  | Stakeholder communication & formatting       |
| `CoordinatorAgent` | (enhanced)    | Task planning, routing, system mapping       |
| `SystemMapperAgent` | (deprecated) | System mapping; absorbed into Coordinator    |

SystemMapperAgent is **deprecated** and its responsibilities are folded into `CoordinatorAgent`.

---

## 3. Roles & Responsibilities

### 3.1 OpportunityAgent

- **Stage:** Opportunity (Stage 1)
- **File:** `src/agents/OpportunityAgent.ts`
- **ID:** `opportunity-v1`

Responsibilities:

- Analyze business context and discovery inputs.
- Identify value opportunities and outcome hypotheses.
- Link interventions → KPIs → business value.
- Produce SDUI layouts (e.g. `OutcomeEngineeringPage`).
- Store successful hypotheses and causal patterns in semantic memory.

### 3.2 TargetAgent

- **Stage:** Target (Stage 2)
- **File:** `src/agents/TargetAgent.ts`
- **ID:** `target-v1`

Responsibilities:

- Design interventions for identified opportunities.
- Build business cases and ROI models.
- Map interventions to KPIs and constraints.
- Output SDUI layouts such as `InterventionDesignPage`.

### 3.3 RealizationAgent

- **Stage:** Realization (Stage 3)
- **File:** `src/agents/RealizationAgent.ts`
- **ID:** `realization-v1`

Responsibilities:

- Track intervention execution and KPI progress.
- Analyze feedback loops and behavior changes.
- Emit `RealizationMonitoringPage` SDUI pages.
- Feed data back to ExpansionAgent.

### 3.4 ExpansionAgent

- **Stage:** Expansion (Stage 4)
- **File:** `src/lib/agent-fabric/agents/ExpansionAgent.ts`
- **ID:** `expansion-v1`

Responsibilities:

- Identify upsell/cross-sell opportunities from realized value.
- Quantify expansion potential and readiness.
- Create `ExpansionOpportunitiesPage` SDUI layouts.
- Seed new Opportunity cycles.

### 3.5 IntegrityAgent

- **Stage:** Cross-cutting
- **File:** `src/agents/IntegrityAgent.ts`
- **ID:** `integrity-v1`

Responsibilities:

- Evaluate completeness, accuracy, usefulness of artifacts.
- Provide gap analysis and improvement recommendations.
- Support feedback into memory & offline evaluation.
- Emit `QualityReportPage` SDUI layouts.

### 3.6 CommunicatorAgent

- **Stage:** Cross-cutting
- **File:** `src/agents/CommunicatorAgent.ts`
- **ID:** `communicator-v1`

Responsibilities:

- Format outputs for different stakeholders.
- Generate executive summaries, narratives, and decks.
- Integrate with email/Slack and SDUI components.

### 3.7 CoordinatorAgent

- **Stage:** Orchestration
- **File:** `src/agents/CoordinatorAgent.ts`
- **ID:** `coordinator-v1`

Responsibilities:

- Plan tasks and sub-goals from user intent.
- Route sub-goals to the right agents.
- Generate SDUI layout directives.
- Perform system mapping (replacing SystemMapperAgent).
- Log decisions for audit and introspection.

---

## 4. Execution Architecture

### 4.1 BaseAgent

All concrete agents extend a common `BaseAgent` (location may vary, e.g. `src/lib/agent-fabric/agents/BaseAgent.ts`). It provides:

- Integration with `LLMGateway` (multi-provider LLM access).
- Access to `MemorySystem` (episodic, semantic, working, procedural memory).
- Circuit breaker–wrapped `secureInvoke()` with safety limits.
- Hooks for rules framework enforcement and tool usage.
- SDUI generation helpers.

Simplified interface:

```ts
interface IAgent {
  execute(sessionId: string, input: any): Promise<AgentOutput>;
  canHandle(intent: string): boolean;
  getHealthStatus(): Promise<HealthStatus>;
}

interface AgentOutput {
  result: any;
  confidence_level: 'high' | 'medium' | 'low';
  confidence_score: number;
  reasoning: string;
  hallucination_check: boolean;
  metadata?: Record<string, any>;
}
```

### 4.2 Circuit Breaker & Safety Limits

`BaseAgent.secureInvoke()` is wrapped with a circuit breaker (see `CircuitBreaker.ts` and `LLMGateway`):

Typical limits:

- Max LLM calls per execution
- Max recursion depth
- Per-session cost ceiling
- Execution timeouts

Circuit breaker states (`CLOSED`, `OPEN`, `HALF_OPEN`) are exercised in resilience tests and surfaced in observability.

### 4.3 LLM Gateway & Tools

Agents typically:

1. Build prompt(s) using prompt templates (managed by Prompt Version Control).
2. Call `llmGateway.complete()` with provider-agnostic config.
3. Optionally call tools (via ToolRegistry) for structured operations.
4. Use semantic memory for retrieval (vector store) with **tenant filters**.

---

## 5. Agent Orchestration & Consolidation

### 5.1 UnifiedAgentOrchestrator

The orchestration layer was consolidated from multiple orchestrators into a single **UnifiedAgentOrchestrator** (`src/services/UnifiedAgentOrchestrator.ts`):

- Replaces `AgentOrchestrator` and `StatelessAgentOrchestrator`.
- Coordinates:
  - Intent routing
  - Agent selection
  - Workflow execution
  - SDUI generation

Deprecated services:

- `src/services/AgentOrchestrator.ts`
- `src/services/StatelessAgentOrchestrator.ts`

### 5.2 Canonical Agent Identity

The mapping from old identities to new stable names is captured here (superseding `AGENT_MAPPING.md` and `AGENT_NAMING_MAPPING.md`):

| Old Name                | New Name          | Purpose                    |
|-------------------------|-------------------|----------------------------|
| `OutcomeEngineerAgent`  | `OpportunityAgent`| Opportunity discovery      |
| `InterventionDesignerAgent` | `TargetAgent` | Intervention design        |
| `RealizationLoopAgent`  | `RealizationAgent`| Realization & feedback    |
| `ValueEvalAgent`        | `IntegrityAgent`  | Quality & integrity        |
| `SystemMapperAgent`     | (merged) → `CoordinatorAgent` | System mapping |

Tests and code should reference **only the new names**.

---

## 6. Tracing & Observability for Agents

Agents are fully instrumented with OpenTelemetry to trace:

- `execute` spans (per-agent execution)
- Nested spans for `secureInvoke` and tool calls
- Events for reasoning, confidence, and errors

### 6.1 Tracing Patterns

From the prior `AGENT_TRACING_GUIDE`:

```ts
import {
  traceAgentExecution,
  traceAgentInvocation,
  addAgentEvent,
  recordAgentConfidence,
  recordAgentReasoning
} from '@/lib/observability';

export class MyAgent extends BaseAgent {
  public lifecycleStage = 'opportunity';
  public version = '1.0.0';
  public name = 'OpportunityAgent';

  async execute(sessionId: string, input: any) {
    return traceAgentExecution(
      'execute',
      {
        agentId: this.agentId,
        agentName: this.name,
        lifecycleStage: this.lifecycleStage,
        version: this.version,
        sessionId
      },
      async (span) => {
        const result = await this.processInput(input);
        addAgentEvent('processing_complete', {
          'input.size': JSON.stringify(input).length,
          'output.size': JSON.stringify(result).length
        });
        return result;
      }
    );
  }
}
```

`traceAgentInvocation` similarly wraps secure invocations and records confidence metrics via `recordAgentConfidence` and `recordAgentReasoning`.

### 6.2 Metrics

Per-agent metrics (exported to Prometheus / Grafana):

- Invocation counts
- Latency percentiles (P50/P95/P99)
- Cost per agent
- Confidence distribution & hallucination flags
- Error rates by category

---

## 7. Rules & Safety for Agents

Agents must obey the **Rules Framework**:

- **Global rules** (GR-xxx) – systemic safety, data sovereignty, PII, cost.
- **Local rules** (LR-xxx) – scope of authority, behaviour, workflow logic.

Before executing high-risk actions, agents should:

1. Build a global rule context (tenant, user, agent, action, payload).
2. Optionally build a local rule context (agent-specific policies).
3. Call `enforceRules()` and react to violations.

Example (pseudo):

```ts
const result = await enforceRules({
  agentId: this.id,
  agentType: 'opportunity',
  userId,
  tenantId,
  action: 'calculate_roi',
  payload
});

if (!result.allowed) {
  // surface userMessages and apply fallbackActions
  throw new PolicyViolationError(result.violations);
}
```

---

## 8. Prompt & Memory Integration

### 8.1 Prompt Version Control

Agents should **not** hardcode prompts inline; instead they:

- Use Prompt Version Control (PVC) to fetch active prompt versions by key.
- Rely on A/B testing and metrics to evolve prompts safely.

Common pattern:

1. `executePrompt(promptKey, variables, userId, options)` → `{ prompt, version, executionId }`.
2. Call LLM with chosen model and parameters from version metadata.
3. Record execution metrics (latency, cost, success) and user feedback.

### 8.2 Memory System

Agents integrate with the `MemorySystem` for:

- **Semantic memory** (vector store), always **filtered by tenant_id**.
- **Episodic memory** (per-session facts).
- **Working memory** (current-task scratch space).

Example:

```ts
const memories = await memorySystem.search({
  query: embedding,
  filter: { metadata: { tenant_id: currentTenantId } },
  limit: 5
});
```

Agents should never issue unfiltered vector queries.

---

## 9. Developer Workflow: Adding / Modifying Agents

### 9.1 Adding a New Agent

1. **Define role & stage**
   - Decide whether it’s lifecycle-specific or cross-cutting.
   - Define responsibilities and integration points.

2. **Implement class** extending `BaseAgent`
   - Choose `agentId`, `name`, `lifecycleStage`.
   - Wire in rules enforcement, tools, memory, and tracing.

3. **Register in Agent Fabric**
   - Add to relevant registries (AgentRegistry, UnifiedAgentOrchestrator, ToolRegistry where needed).

4. **Add tests**
   - Unit tests for agent logic and prompt usage.
   - Integration tests for orchestration with CoordinatorAgent.

5. **Update docs** (this guide + any user-facing references).

### 9.2 Renaming Agents (Legacy → New)

All legacy references to old names should be migrated to the new taxonomy (see mapping in §2.3). Tests and documentation should avoid the old names.

---

## 10. File & Module Map

Key files related to agents and Agent Fabric:

- `src/agents/OpportunityAgent.ts`
- `src/agents/TargetAgent.ts`
- `src/agents/RealizationAgent.ts`
- `src/agents/IntegrityAgent.ts`
- `src/agents/CommunicatorAgent.ts`
- `src/agents/CoordinatorAgent.ts`
- `src/lib/agent-fabric/agents/ExpansionAgent.ts`
- `src/lib/agent-fabric/agents/BaseAgent.ts`
- `src/lib/agent-fabric/LLMGateway.ts`
- `src/lib/agent-fabric/MemorySystem.ts`
- `src/lib/observability.ts` (agent tracing helpers)
- `src/services/UnifiedAgentOrchestrator.ts`
- `src/lib/rules/*` (rules framework)
- `src/tools/*` (tool implementations)

---

## 11. Migration Notes

- This guide **replaces** scattered per-agent docs (`AGENT_MAPPING`, `AGENT_ROLES_POST_RENAME`, `AGENT_CONSOLIDATION`, `AGENT_TRACING_GUIDE`, etc.).
- For SDUI behaviour and canvas interactions, see:
  - `TECHNICAL_REFERENCE.md` (SDUI + workflows)
  - `FEATURE_DOCUMENTATION.md` (dynamic bindings, partial mutations, state, tools, rules, prompts).

This file is the canonical reference for **agents and the Agent Fabric** going forward.
