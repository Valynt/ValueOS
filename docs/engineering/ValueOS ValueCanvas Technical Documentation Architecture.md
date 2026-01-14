# ValueOS/ValueCanvas Technical Documentation Architecture
## Comprehensive Documentation Outline

**Document Version:** 1.0.0
**Target Audience:** Systems Architects, Full-Stack Engineers, AI Engineers, and DevOps
**Total Estimated Length:** ~50,000 words
**Status:** Draft / Outline Phase

---

## 1. Introduction & System Philosophy
**Estimated Word Count:** 2,500 words

### 1.1 The Value Operating System (VOS) Vision
*   **Definition:** Definition of VOS not as a tool, but as an enterprise-wide framework for shifting from feature selling to financially quantified, outcome-driven value creation.
*   **Core Philosophy:** Shifting from CRM (Transactional) to "Living Value Graphs" (Transformational).
*   **The VOS Manifesto:** detailed breakdown of the 12 Core Principles (e.g., "Value is the First Principle," "Quantified Conservatively," "Moral Contract") and how they translate to technical constraints.

### 1.2 High-Level Architecture
*   **The Dual-Brain Paradigm:**
    *   **Left Brain:** Conversational AI (Agent Thread, Reasoning).
    *   **Right Brain:** Interactive Canvas (Visual, Analytical, SDUI).
*   **System Context:** High-level block diagram showing Clients, API Gateway, Agent Fabric, Value Fabric, and Infrastructure.

### 1.3 Systemic Outcome Framework (SOF)
*   **Concept:** Overview of how business context, interventions, and outcomes are mapped programmatically.
*   **Data Structure:** Introduction to the 9 core tables (`sof_system_maps`, `sof_entities`, `sof_relationships`, etc.).

> **Key Excerpt:** "A Value Operating System (VOS) is an operating philosophy, a governance model, and a unified value fabric—a cross-functional system for orchestrating value creation, value communication, and value proof across the enterprise."

---

## 2. Agent Fabric Deep Dive (LLM-MARL Architecture)
**Estimated Word Count:** 10,000 words

### 2.1 The Agent Taxonomy (Post-Rename)
Detailed technical specifications for the 7 specialized agents.

*   **Primary Lifecycle Agents:**
    1.  **OpportunityAgent:** Discovery, system mapping, hypothesis generation.
    2.  **TargetAgent:** Intervention design, business case building, ROI modeling.
    3.  **RealizationAgent:** KPI tracking, feedback loop monitoring, value proof.
    4.  **ExpansionAgent:** Upsell/cross-sell identification, gap analysis.
*   **Cross-Cutting Agents:**
    5.  **IntegrityAgent:** Quality assurance, Manifesto compliance, hallucination checks.
    6.  **CommunicatorAgent:** Narrative generation, stakeholder formatting.
    7.  **CoordinatorAgent:** Orchestration, task planning, routing (absorbed SystemMapperAgent).

### 2.2 BaseAgent Architecture
The unified class structure extended by all agents.

*   **Core Capabilities:**
    *   **LLMGateway:** Multi-provider abstraction (Together.ai primary, OpenAI fallback).
    *   **MemorySystem:** 4-part architecture (Episodic, Semantic, Working, Procedural).
    *   **Observability:** OpenTelemetry instrumentation.
*   **Secure Invocation Pattern:**
    *   Zod schema validation for structured outputs.
    *   Confidence scoring (High/Medium/Low).
    *   **Circuit Breakers:** Prevention of runaway costs and recursion loops.

### 2.3 Agent Orchestration & Workflow
*   **DAG-based Workflows:** Using `WorkflowOrchestrator` to manage dependencies.
*   **Saga Pattern:** Compensation handlers for rollback on failure.
*   **Inter-Agent Communication:** Async Message Bus and Event Topics (`value.opportunity.created`, etc.).

#### **[DIAGRAM NEEDED: Agent Interaction Sequence]**
*Visualizing the flow: User Request -> Coordinator -> OpportunityAgent -> (Integrity Check) -> Memory Write.*

#### **[CODE EXAMPLE: Secure Invocation Signature]**
```typescript
protected async secureInvoke<T>(
  sessionId: string,
  input: any,
  resultSchema: T,
  options: SecureInvocationOptions
): Promise<SecureAgentOutput & { result: z.infer<T> }> {
    // Implementation of circuit breaker, hallucination check,
    // and confidence scoring logic
}
```

---

## 3. Value Fabric Deep Dive (Data & Logic Layer)
**Estimated Word Count:** 8,000 words

### 3.1 The "Single Source of Truth"
*   **Concept:** Value Trees, ROI models, and Proof Points living in a unified data layer, not static documents.
*   **Semantic Alignment:** Ensuring marketing, sales, and CS use the same value definitions.

### 3.2 Data Models and Schemas
*   **Value Modeling Reasoning Trace (VMRT):** Detailed breakdown of the JSON schema controlling value logic.
    *   *Components:* `reasoning_steps`, `value_model` (financial_impact, risks), `sensitivity_analysis`.
*   **ROI Engine:** The calculation layer (`ROI = (LTV uplift – Costs) / Investment`).
*   **SOF Database Schema:** Deep dive into `sof_intervention_points`, `sof_outcome_hypotheses`, and `sof_feedback_loops`.

### 3.3 Governance & Integrity
*   **ManifestoEnforcer:** The rules engine (Policy-as-Code) that validates artifacts against the 12 principles.
*   **Versioning:** Semantic versioning for all value artifacts (v1.0 -> v1.1).

#### **[DIAGRAM NEEDED: Entity Relationship Diagram]**
*Visualizing the relationships between `value_cases`, `sof_system_maps`, `financial_models`, and `agent_audit_log`.*

---

## 4. Server-Driven UI (SDUI) & Generative Interface
**Estimated Word Count:** 7,000 words

### 4.1 SDUI Architecture
*   **Canvas Schema Service:** Server-side schema generation based on workspace state and lifecycle stage.
*   **Action Router:** Canonical routing for `mutate_component`, `add_component`, `reorder_components`.
*   **Runtime Engine:** Client-side component resolution and optimistic rendering.

### 4.2 Dynamic Data Binding
*   **Mechanism:** How UI components bind to backend value streams.
*   **Resolution:** `useRealtimeUpdates` hook and WebSocket push.

### 4.3 Generative UI Workflow
1.  Agent determines user intent.
2.  LLM selects optimal layout/components.
3.  Schema is generated and validated.
4.  UI updates in real-time (target <100ms generation).

#### **[CODE EXAMPLE: SDUI Data Binding]**
```json
{
  "$bind": "metrics.revenue_uplift",
  "$source": "realization_engine",
  "$transform": "currency",
  "$fallback": "Calculating…",
  "$refresh": 30000,
  "$cache": "revenue_key"
}
```

---

## 5. Integration & Data Flow
**Estimated Word Count:** 5,000 words

### 5.1 API Layer
*   **Tech Stack:** Node.js 20+, Express 4.18, TypeScript 5.5.
*   **Endpoints:** `/api/agents`, `/api/workflow`, `/api/documents`.
*   **Versioning:** `createVersionedApiRouter()` strategy.

### 5.2 Multi-Tenancy Architecture
*   **Isolation:** UUID-based `tenant_id` in JWT claims.
*   **Database Strategy:** Shared cluster with Row-Level Security (RLS) + isolated schemas.
*   **Storage:** Bucket prefixing per tenant with SSE-KMS encryption.

### 5.3 Event-Driven Architecture
*   **Message Bus:** Async inter-agent communication.
*   **WebSockets:** Real-time updates via `RealtimeUpdateService`.

---

## 6. Architectural Patterns & Safety
**Estimated Word Count:** 6,000 words

### 6.1 Safety Mechanisms
*   **Circuit Breakers:**
    *   *Agent Level:* Max LLM calls, recursion depth.
    *   *System Level:* Kill switch, emergency shutdown.
*   **Hallucination Detection:** Comparison of outputs against "Knowledge Fabric" and confidence thresholds.

### 6.2 Policy-as-Code (Rules Framework)
*   **Global Rules (GR-xxx):** Platform constitution (e.g., "GR-005: PII detection").
*   **Local Rules (LR-xxx):** Tenant-specific logic.
*   **Enforcement:** Pre-execution validation via `enforceRules()`.

### 6.3 Observability
*   **Stack:** OpenTelemetry, Prometheus, Grafana, Sentry.
*   **Tracing:** Nested spans for Agent execution -> Tool Call -> LLM Token usage.
*   **Metrics:** Confidence scores, hallucination flags, cost tracking per session.

> **Key Excerpt:** "Integrity overrides convenience. All value promises must be honored with integrity." — *VOS Manifesto*

---

## 7. Development & Deployment
**Estimated Word Count:** 4,000 words

### 7.1 Tech Stack Summary
*   **Frontend:** React 18.3, Vite 7.2, Tailwind 3.4, Zustand.
*   **Backend:** Node.js, Express, Supabase (Postgres + pgvector).
*   **AI:** Together.ai, OpenAI, LangGraph (custom impl).

### 7.2 CI/CD & Testing
*   **Pipeline:** GitHub Actions (Lint -> Typecheck -> Unit -> RLS Test -> Security Scan -> Build).
*   **Testing Layers:**
    *   *Unit:* Vitest.
    *   *Integration:* Agent orchestration tests.
    *   *E2E:* Playwright for full user flows.
    *   *Security:* RLS policy validation.

### 7.3 Deployment Architecture
*   **Containerization:** Docker + Kubernetes.
*   **Edge:** Caddy reverse proxy, Supabase Edge Functions.
*   **Environment:** Dev Container, Staging, Production strategies.

---

## 8. Appendices & References
**Estimated Word Count:** 7,500 words

### 8.1 JSON Schemas
*   Full `QHMEO-Master Schema` (Value Modeling Reasoning Trace).
*   SDUI Component Schemas.

### 8.2 Glossary
Definitions of key terms: *Value Fabric, Agent Fabric, Intervention Point, Value Tree, Circuit Breaker.*

### 8.3 Troubleshooting Guide
*   Common errors (AgentFabric not initialized, RLS permission denied).
*   Debug commands and log analysis.

---

## Visuals & Diagrams Needed List

1.  **Architecture Overview:** High-level block diagram (Frontend, API, Agent Fabric, Data Plane).
2.  **Agent Fabric Connectivity:** Radial diagram showing CoordinatorAgent in center connected to 6 specialized agents and the Message Bus.
3.  **Secure Invocation Flow:** Sequence diagram showing `secureInvoke` -> Validation -> LLM -> Circuit Breaker -> Result.
4.  **SDUI Data Flow:** User Action -> Router -> Agent -> Schema Gen -> WebSocket -> Client Render.
5.  **Value Tree Hierarchy:** Visual representation of Outcome -> KPI -> Capability -> ROI.
6.  **Entity Relationship Diagram (ERD):** Key Supabase tables (18 core tables) and their relationships.