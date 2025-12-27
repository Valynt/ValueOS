# ValueOS: Agent Fabric & Value Fabric Architectural Specification

**Author:** ValueOS Architecture Team  
**Date:** December 25, 2025  
**Status:** High-Fidelity Technical Documentation

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
   - [The ValueOS Manifesto](#the-valueos-manifesto)
   - [Core Architectural Benefits](#core-architectural-benefits)
2. [Agent Fabric: The Cognitive Layer](#2-agent-fabric-the-cognitive-layer)
   - [LLM-MARL Overview](#llm-marl-overview)
   - [7-Agent Taxonomy](#7-agent-taxonomy)
   - [BaseAgent & Memory Architecture](#baseagent--memory-architecture)
   - [Secure Invocation Patterns](#secure-invocation-patterns)
3. [Value Fabric: The System of Record](#3-value-fabric-the-system-of-record)
   - [Value Trees & ROI Models](#value-trees--roi-models)
   - [VMRT: Value Modeling Reasoning Trace](#vmrt-value-modeling-reasoning-trace)
   - [KPI Ontology & Economic Structure](#kpi-ontology--economic-structure)
   - [SOF: Systemic Outcome Framework Tables](#sof-systemic-outcome-framework-tables)
4. [Integration & Orchestration](#4-integration--orchestration)
   - [The Read-Reason-Write Cycle](#the-read-reason-write-cycle)
   - [Saga Pattern Workflows](#saga-pattern-workflows)
   - [Integrity Validation Loops](#integrity-validation-loops)
5. [Roadmap & Conclusion](#5-roadmap--conclusion)
   - [Strategic Takeaways](#strategic-takeaways)

---

## 1. Executive Summary

ValueOS represents a paradigm shift in enterprise software, moving from static systems of record to a **Systemic Value Orchestration Platform**. It is built upon a "Dual-Brain" architecture that separates cognitive reasoning from persistent truth. 

The **Agent Fabric** acts as the cognitive processor, utilizing a Multi-Agent Reinforcement Learning (LLM-MARL) system to navigate complex business environments. Complementing this, the **Value Fabric** serves as an immutable, semantic ledger that transforms ephemeral AI reasoning into enduring enterprise assets.

### The ValueOS Manifesto
The system is governed by twelve core principles that transition from corporate philosophy to technical constraints (Policy-as-Code):
*   **Value is the First Principle:** Every artifact must drive a measurable outcome.
*   **Unified Enterprise Value:** Alignment across Sales, Success, and Product.
*   **Conservative Quantification:** Defaults to lower bounds (P25/P50 benchmarks) to maintain credibility.
*   **Continuous Proof:** Hypothetical value must be validated by real-time telemetry.

### Core Architectural Benefits
1.  **Hallucination Mitigation:** The `IntegrityAgent` blocks any reasoning trace that lacks a causal link or empirical baseline.
2.  **Auditability:** Every financial claim is backed by a Value Modeling Reasoning Trace (VMRT).
3.  **Adaptive UI:** Using Server-Driven UI (SDUI), the interface evolves based on agent-driven insights without client-side deployments.

---

## 2. Agent Fabric: The Cognitive Layer

The Agent Fabric operates as a sophisticated graph-based orchestration engine. Unlike standard LLM implementations, it focuses on **Bounded Autonomy**, where agents execute tasks within strictly governed lifecycle stages.

![Agent Fabric Taxonomy](https://r2.flowith.net/files/jpeg/VOJK1-agent_fabric_taxonomy_diagram_index_0@1024x1024.jpeg)
*Figure 1.1: Radial Taxonomy of ValueOS Specialized Agents*

### LLM-MARL Overview
The multi-agent system utilizes reinforcement learning principles to optimize cooperation. Agents do not merely generate text; they collaborate to build and evolve the **Value Fabric** through a Directed Acyclic Graph (DAG) of tasks.

### 7-Agent Taxonomy
The fabric consists of seven specialized roles categorized by their relationship to the customer value lifecycle:

| Agent Role | Classification | Primary Responsibility |
| :--- | :--- | :--- |
| **CoordinatorAgent** | Orchestration | Decomposes user intent into DAG execution plans. |
| **OpportunityAgent** | Discovery | Identifies leverage points and maps causal entities. |
| **TargetAgent** | Definition | Constructs financial ROI models and intervention designs. |
| **RealizationAgent** | Realization | Monitors telemetry to audit "Realized vs. Committed" value. |
| **ExpansionAgent** | Expansion | Identifies upsell opportunities through gap analysis. |
| **IntegrityAgent** | Governance | Validates all outputs against Manifesto rules and benchmarks. |
| **CommunicatorAgent**| Interface | Generates stakeholder narratives and SDUI schemas. |

### BaseAgent & Memory Architecture
All agents extend the `BaseAgent` abstract class, which standardizes cognitive infrastructure.

![Four Part Memory System](https://r2.flowith.net/files/jpeg/GRPGB-four_part_memory_system_architecture_index_4@1024x1024.jpeg)
*Figure 1.2: The 4-Part Cognitive Memory Architecture*

*   **Episodic Memory:** Current session context.
*   **Semantic Memory:** RAG-based access to the Value Fabric (pgvector).
*   **Working Memory:** A scratchpad for intermediate reasoning.
*   **Procedural Memory:** Stored successful workflow patterns.

### Secure Invocation Patterns
The `secureInvoke` pattern wraps raw LLM interactions in a safety layer enforcing structure validation (via Zod), circuit breakers, and observability.

```typescript
/**
 * Standard execution pattern for ValueOS Agents.
 */
protected async secureInvoke<T>(
  sessionId: string,
  input: any,
  resultSchema: ZodSchema<T>
): Promise<SecureAgentOutput<T>> {
  
  // 1. Circuit Breaker Check
  if (this.circuitBreaker.isOpen(sessionId)) {
    throw new CircuitBreakerError("Safety limit reached");
  }

  // 2. Pre-execution Policy Enforcement
  await this.rulesEngine.enforce(input, 'PRE_EXECUTION');

  // 3. LLM Execution via Gateway
  const rawOutput = await this.llmGateway.generate({
    model: 'gpt-4-turbo',
    prompt: this.constructPrompt(input),
    tools: this.tools
  });

  // 4. Structure & Integrity Validation
  const structuredResult = resultSchema.parse(JSON.parse(rawOutput));
  await this.integrityAgent.audit(structuredResult);

  return { result: structuredResult };
}
```

---

## 3. Value Fabric: The System of Record

The **Value Fabric** is the persistent ledger that stores the outputs of agent reasoning. It shifts the paradigm from static fields to **Computational Value Graphs**.

### Value Trees & ROI Models
Value Trees provide the navigational structure for the enterprise, linking executive objectives to technical capabilities:
1.  **L1 Objective:** Strategic goal (e.g., Maximize Free Cash Flow).
2.  **L2 Driver:** Functional lever (e.g., Reduce OPEX).
3.  **L3 Outcome:** Measurable result (e.g., Decrease Invoice Cost).
4.  **L4 Capability:** Technical intervention (e.g., OCR Automation).
5.  **L5 KPI:** The measuring metric.

### VMRT: Value Modeling Reasoning Trace
The VMRT captures the entire cognitive chain used to calculate a value outcome, ensuring transparency for audits.

```json
{
  "trace_id": "VMRT-2025-AX9921",
  "reasoning_steps": [
    {
      "step_type": "impact_calculation",
      "logic": "annual_savings = (current_processing_cost - target_cost) * annual_volume",
      "assumptions": [
        { "factor": "current_processing_cost", "value": 12.50, "basis": "APQC Benchmark" }
      ],
      "output": 600000
    }
  ],
  "confidence_score": 0.92
}
```

### KPI Ontology & Economic Structure
The **Economic Structure Ontology (ESO)** defines over 500 industry-standard KPIs and their mathematical dependencies. It knows, for example, that improving *Manufacturing OEE* necessitates an increase in *Throughput*.

### SOF: Systemic Outcome Framework Tables
The SOF schema provides the relational structure for causal mapping:

```typescript
// Prisma Schema for Systemic Outcomes
model SofRelationship {
  id          String   @id @default(uuid())
  sourceId    String
  targetId    String
  type        RelationType // CAUSAL, FLOW, INFLUENCE
  strength    Float        // Correlation strength -1.0 to 1.0
  formula     String?      // Causal logic
}
```

---

## 4. Integration & Orchestration

The integration between fabrics is bidirectional: Agents read context to reason, and write insights to persist.

![Integration Sequence](https://r2.flowith.net/files/jpeg/8CD03-agent_fabric_integration_sequence_index_5@1024x1024.jpeg)
*Figure 4.1: The Read-Reason-Write Integration Cycle*

### The Read-Reason-Write Cycle
1.  **Read:** `OpportunityAgent` loads the customer's current `sof_system_map`.
2.  **Reason:** `TargetAgent` calculates a new ROI hypothesis based on a capability.
3.  **Integrity Check:** `IntegrityAgent` validates the hypothesis against `sof_benchmarks`.
4.  **Write:** `ValueFabricService` commits the validated VMRT to the database.

### Saga Pattern Workflows
Given the non-deterministic nature of AI, ValueOS uses the **Saga Pattern** for distributed transactions.

![Saga Pattern DAG](https://r2.flowith.net/files/jpeg/I47CH-agent_interaction_dag_saga_index_1@1024x1024.jpeg)
*Figure 4.2: Distributed Transaction Management across Agents*

If an `IntegrityAgent` rejects a commit in Step 3, the `WorkflowOrchestrator` executes **Compensating Transactions** (e.g., rolling back a draft Value Case) to ensure the Fabric never enters an inconsistent state.

### Integrity Validation Loops
Validation is not a manual review but an automated enforcement of the Manifesto.
*   **Conservative Quant:** If a projection exceeds the industry 75th percentile (P75), it is flagged for "Aggressive Estimation."
*   **Causal Completeness:** Financial outcomes without an operational root cause are rejected.

---

## 5. Roadmap & Conclusion

ValueOS is transitioning from heuristic orchestration to fully learned cooperation policies.

| Phase | Milestone | Focus |
| :--- | :--- | :--- |
| **Q1 2026** | Advanced MARL | Learned cooperation policies using PPO. |
| **Q2 2026** | K8s Autoscale | Dynamic scaling of agent pods based on inference load. |
| **Q3 2026** | Open Ontology | ActivityPub-compatible federation of KPI ontologies. |

### Strategic Takeaways
The architecture of ValueOS moves beyond "AI as a tool" to **AI as a Governor**. By embedding the Economic Structure Ontology into the Multi-Agent system, ValueOS ensures that enterprise value is not just promised, but structurally necessitated and continuously proven.

The **Agent Fabric** provides the speed of thought; the **Value Fabric** provides the weight of truth. Together, they form the first operating system for the global value economy.

---
**[End of Documentation]**