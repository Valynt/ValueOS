# Agent Fabric: LLM-MARL Multi-Agent System

## 1. Architectural Overview

The **Agent Fabric** represents the cognitive layer of ValueOS, operating as a sophisticated Multi-Agent Reinforcement Learning (LLM-MARL) system. Unlike standard chatbot implementations which rely on single-turn request/response cycles, the Agent Fabric utilizes a graph-based orchestration engine where specialized autonomous agents collaborate to build, validate, and evolve the **Value Fabric**.

This architecture shifts the paradigm from "stochastic generation" to "governed reasoning." By embedding the **ValueOS Manifesto** principles directly into the agent cognition loops, the system ensures that AI-generated artifacts—from ROI models to UI layouts—are not just plausible, but strategically sound and empirically verifiable.

![Agent Fabric Taxonomy](https://r2.flowith.net/files/jpeg/VOJK1-agent_fabric_taxonomy_diagram_index_0@1024x1024.jpeg)

### Core Design Philosophy: Bounded Autonomy
The system implements a **Bounded Autonomy** pattern. Agents possess high degrees of freedom to plan and execute tasks within specific lifecycle stages, but are strictly constrained by:
1.  **Global/Local Rules Framework (Policy-as-Code):** Hard constraints on behavior, cost, and risk.
2.  **Systemic Outcome Framework (SOF):** Structural constraints requiring valid causal links between interventions and outcomes.
3.  **Circuit Breakers:** Deterministic safety mechanisms that sever execution loops upon anomaly detection.

---

## 2. Agent Taxonomy

The Agent Fabric consists of 7 core agents categorized by their relationship to the customer value lifecycle. Each agent is a specialized instance of the `BaseAgent` class, configured with distinct system prompts, toolsets, and memory access patterns.

| Agent Role | Classification | Lifecycle Stage | Primary Responsibility | Key Inputs | Key Outputs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CoordinatorAgent** | Cross-Cutting | N/A (Orchestration) | Task planning, routing, decomposing complex user intent into sub-agent workflows. | User Prompts, Global State | Execution Plans (DAGs), Task Assignments |
| **OpportunityAgent** | Lifecycle | Stage 1: Discovery | System mapping, pain point identification, value hypothesis generation. | Raw Transcripts, Industry Data | System Maps (`sof_system_maps`), Value Hypotheses |
| **TargetAgent** | Lifecycle | Stage 2: Definition | Intervention design, ROI modeling, business case construction. | Value Hypotheses, Baselines | Financial Models, Intervention Designs |
| **RealizationAgent** | Lifecycle | Stage 3: Realization | KPI tracking, feedback loop monitoring, value proofing. | Telemetry Data, CRM Updates | Proof Points, Variance Reports |
| **ExpansionAgent** | Lifecycle | Stage 4: Expansion | Identifying upsell opportunities, gap analysis against benchmarks. | Realization Data, Benchmarks | Expansion Opportunities, Cross-sell Paths |
| **IntegrityAgent** | Cross-Cutting | Governance | QA, Hallucination checks, Manifesto compliance validation. | Agent Outputs, Manifesto Rules | Validation Scores, Correction Requests |
| **CommunicatorAgent** | Cross-Cutting | Interface | Narrative generation, formatting, stakeholder communication. | Raw Data, Persona Context | Narratives, formatted Markdown/JSON |

---

## 3. Detailed Agent Profiles

### 3.1 OpportunityAgent (The Outcome Engineer)
**Role:** The architect of the problem space. The OpportunityAgent is responsible for translating unstructured customer context into structured System Maps.

*   **Cognitive Architecture:** Uses Chain-of-Thought (CoT) prompting to deconstruct customer interviews into causal nodes (Entities -> Relationships -> Feedback Loops).
*   **SOF Integration:** Directly manipulates `sof_system_maps` and `sof_entities` tables.
*   **Specialized Tools:** `CompanyResearchTool`, `SystemMapBuilder`, `PainQuantifier`.

**Behavioral Pattern (Pseudocode):**
```typescript
async function identifyOpportunities(context: SessionContext) {
  // 1. Ingest raw context (transcripts, docs)
  const entities = await extractEntities(context.unstructuredData);
  
  // 2. Map relationships using SOF logic
  const systemMap = await buildCausalGraph(entities);
  
  // 3. Identify leverage points (High impact, low friction)
  const leveragePoints = analyzeLeverage(systemMap);
  
  // 4. Formulate Hypotheses
  return leveragePoints.map(point => ({
    hypothesis: `Intervening at ${point.node} will result in ${point.projectedOutcome}`,
    confidence: calculateConfidence(point.evidence)
  }));
}
```

### 3.2 TargetAgent (The Intervention Designer)
**Role:** The financial engineer. Transforms qualitative hypotheses into quantitative business cases using the ROI Equation: `(LTV Uplift - Implementation Cost) / Investment`.

*   **Primary Directive:** "Conservative Quantification." It must default to the lower bound of estimation ranges to maintain credibility.
*   **Memory Access:** Heavily relies on **Semantic Memory** (Vector Store) to retrieve benchmark data and similar past cases to validate assumptions.
*   **Validation:** All outputs are auto-submitted to `IntegrityAgent` for "Math Checks" and "Logic Audits."

### 3.3 RealizationAgent (The Proof Engine)
**Role:** The continuous auditor. It monitors the divergence between *Committed Value* (from TargetAgent) and *Realized Value* (from live telemetry).

*   **Data Binding:** Generates the configuration for SDUI components to bind to real-time data streams.
*   **Trigger Logic:**
    *   IF `realized_value` < `committed_value` * `threshold` THEN trigger `InterventionWorkflow`.
    *   IF `realized_value` > `committed_value` THEN trigger `ExpansionSignal`.

### 3.4 IntegrityAgent (The Governor)
**Role:** The systemic superego. The IntegrityAgent does not produce value directly; it validates the value produced by others. It is the only agent with "Veto Power" to block a workflow transition.

![Agent Fabric Integration Sequence](https://r2.flowith.net/files/jpeg/8CD03-agent_fabric_integration_sequence_index_5@1024x1024.jpeg)

**Validation Protocol:**
1.  **Hallucination Check:** Cross-references claims against the Knowledge Fabric.
2.  **Manifesto Compliance:** Checks against rules like "All value reduces to Revenue, Cost, or Risk."
3.  **Security Audit:** Scans for PII or cross-tenant data leakage.

---

## 4. BaseAgent Architecture

All agents extend the `BaseAgent` abstract class, which standardizes the cognitive infrastructure, memory interaction, and safety protocols. This ensures that no agent operates outside the bounds of system governance.

![Base Agent Architecture UML](https://r2.flowith.net/files/jpeg/8EJ9N-base_agent_architecture_uml_index_2@1024x1024.jpeg)

### 4.1 Core Components

*   **LLMGateway:** A provider-agnostic abstraction layer handling model selection (Together.ai vs. OpenAI), retries, and rate limiting.
*   **MemorySystem:** A 4-part cognitive architecture allowing agents to maintain state and learn over time.
    *   *Episodic:* Current session context (short-term).
    *   *Semantic:* RAG via pgvector (long-term knowledge).
    *   *Working:* Scratchpad for current reasoning tasks.
    *   *Procedural:* Stored "skills" and successful workflow patterns.

![Four Part Memory System](https://r2.flowith.net/files/jpeg/GRPGB-four_part_memory_system_architecture_index_4@1024x1024.jpeg)

### 4.2 Secure Invocation Pattern (`secureInvoke`)

The `secureInvoke` method is the critical entry point for all agent actions. It wraps the raw LLM interaction in a safety layer that enforces structured outputs (via Zod), circuit breakers, and observability.

```typescript
/**
 * Executes an agent action with full safety, validation, and observability wrapper.
 */
protected async secureInvoke<T>(
  sessionId: string,
  input: any,
  resultSchema: ZodSchema<T>,
  options: SecureInvocationOptions
): Promise<SecureAgentOutput<T>> {
  
  // 1. Circuit Breaker Check (Cost & Recursion depth)
  if (this.circuitBreaker.isOpen(sessionId)) {
    throw new CircuitBreakerError("Safety limit reached for session");
  }

  // 2. Policy Enforcement (Pre-execution)
  await this.rulesEngine.enforce(input, 'PRE_EXECUTION');

  // 3. Context Construction (Memory Retrieval)
  const context = await this.memory.retrieveContext(input);

  // 4. LLM Execution (with Retry/Backoff)
  const rawOutput = await this.llmGateway.generate({
    model: this.selectModel(options.complexity),
    prompt: this.constructPrompt(input, context),
    tools: this.tools
  });

  // 5. Structure Validation
  const structuredResult = resultSchema.parse(JSON.parse(rawOutput));

  // 6. Hallucination & Integrity Check (Post-execution)
  const confidence = await this.detectHallucination(structuredResult, context);
  if (confidence < this.CONFIDENCE_THRESHOLD) {
    // Self-Correction Loop
    return this.refineOutput(structuredResult, context);
  }

  // 7. Telemetry & Memory Commit
  this.telemetry.recordSpan(this.agentId, 'execution', { ... });
  await this.memory.commit(sessionId, structuredResult);

  return { result: structuredResult, metadata: { confidence, cost: ... } };
}
```

### 4.3 Circuit Breakers
To prevent "runaway agents" (infinite loops or excessive token usage), the BaseAgent includes hard-coded safety limits:
*   **Max Recursion Depth:** 5 levels of sub-agent delegation.
*   **Cost Ceiling:** $X.XX per session hard stop.
*   **Time-to-Live (TTL):** Maximum execution time per invocation.

---

## 5. Orchestration & Interactions

The Agent Fabric uses a **Directed Acyclic Graph (DAG)** model for workflow orchestration, managed by the `WorkflowOrchestrator` service. This replaces brittle imperative code with dynamic, state-aware planning.

### 5.1 The Saga Pattern
Given the non-deterministic nature of LLMs, the system employs the Saga Pattern for distributed transactions. If an agent fails in Step 4 of a workflow, the Orchestrator executes **Compensating Transactions** to roll back state changes made in Steps 1-3, ensuring the Value Fabric never enters an inconsistent state.

![Agent Interaction DAG/Saga](https://r2.flowith.net/files/jpeg/I47CH-agent_interaction_dag_saga_index_1@1024x1024.jpeg)

### 5.2 Inter-Agent Communication
Agents do not call each other directly to avoid tight coupling. Communication is mediated via:
1.  **Message Bus:** Asynchronous event queue (e.g., `value.opportunity.created`).
2.  **Shared Memory:** Agents read/write to the shared `so_` tables and vector stores, using the database as the synchronization primitive.

**Example Orchestration Flow:**
1.  **User:** "Analyze the ROI for the new logistics module."
2.  **CoordinatorAgent:** Decomposes intent -> Creates `WorkflowID: 101`.
3.  **Step 1:** Routes to `OpportunityAgent` to fetch logistics system map.
4.  **Step 2:** Routes to `TargetAgent` to calculate financial impact.
5.  **Step 3:** Routes to `IntegrityAgent` to validate assumptions.
    *   *Failure:* IntegrityAgent rejects assumption X.
    *   *Compensation:* Workflow reverts to Step 2 with "Correction Request".
6.  **Step 4:** Routes to `CommunicatorAgent` to format output.

---

## 6. Observability & Safety

The "Black Box" nature of LLMs is mitigated through aggressive instrumentation and a "Human-in-the-Loop" (HITL) design.

### 6.1 OpenTelemetry Instrumentation
Every cognitive step is a trace span. This allows engineers to visualize the "Thought Process" of the agent swarm.
*   `agent.thought`: The internal reasoning chain (hidden from user).
*   `agent.tool_call`: External API execution (e.g., querying `sof_system_maps`).
*   `agent.response`: The final output delivered to the UI.

### 6.2 The Rules Framework (Policy-as-Code)
Safety is enforced via the `ManifestoEnforcer` service, which applies two tiers of rules:

*   **Global Rules (GR):** Immutable system laws.
    *   *GR-004:* No cross-tenant data access (enforced via RLS).
    *   *GR-005:* Redact all PII before sending to LLM.
*   **Local Rules (LR):** Tenant-specific configurations.
    *   *LR-102:* "Always output currency in EUR."
    *   *LR-105:* "Require managerial approval for ROIs > $1M."

---

## 7. Integration with Value Fabric

The Agent Fabric is the writer; the **Value Fabric** is the ledger. While agents perform the reasoning, the enduring truth is stored within the Value Fabric's rigorous data structures.

> *Transition Note:* The outputs of the Agent Fabric (System Maps, Financial Models, Narratives) are not stored as static documents but are decomposed and persisted into the **Value Fabric**—the relational and semantic core of the system. This ensures that an insight generated by an agent today becomes part of the enterprise knowledge graph forever.

[Proceed to Value Fabric Documentation >](./value-fabric-architecture.md)