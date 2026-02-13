# Architectural Design Brief: The Perfect Agentic Workflow for Value Engineering (ValueOS)

### 1. Executive Summary
The mission of **ValueOS** is to transition Value Engineering (VE) from a fragmented, qualitative exercise into a high-precision, decision-grade engine. ValueOS acts as a "Command Console" for VEs, designed to transform ambiguous sales opportunities into rigorous business cases. By leveraging an agentic, hypothesis-driven architecture, the platform automates the heavy lifting of data synthesis, financial modeling, and narrative construction, allowing the VE to focus on strategic alignment and executive-level validation. The goal is to produce outcomes that are not merely persuasive, but empirically "CFO-defensible."

---

### 2. The Agentic Workflow Philosophy
ValueOS rejects the "Chatbot" paradigm in favor of a **Hypothesis-First** approach. The system does not wait for user prompts to build a case; it proactively generates a financial thesis based on initial discovery signals and then iterates through a rigorous validation loop.

#### The Core Loop:
1.  **Hypothesis**: The system proposes a value driver (e.g., "Reducing Days Sales Outstanding by 12%").
2.  **Model**: A financial logic agent builds the underlying calculation (the "Value Tree").
3.  **Evidence**: A retrieval agent fetches grounding data (EDGAR filings, 10-Ks, industry benchmarks).
4.  **Narrative**: A linguistic agent translates the math into a vertical-specific business story.
5.  **Objection**: A "Red Team" agent stress-tests the logic, simulating CFO pushback.
6.  **Revision**: The workflow auto-corrects based on objections.
7.  **Approval**: The human VE reviews and locks the component.

---

### 3. Workflow Orchestration & Safety (Saga Pattern)
To manage the complexity of multi-agent interactions, ValueOS utilizes a **Distributed Saga Pattern** to ensure data consistency and system stability across long-running business processes.

#### Explicit State Machine Transitions
| Phase | State | Trigger | Output |
| :--- | :--- | :--- | :--- |
| **Discovery** | `INITIATED` | Opportunity ID Ingest | Context Map & Pain Points |
| **Modeling** | `DRAFTING` | Hypothesis Confirmed | Financial Value Tree (JSON) |
| **Integrity** | `VALIDATING` | Model Completion | Confidence Score & Citations |
| **Narrative** | `COMPOSING` | Integrity Check Pass | Executive Summary & PPTX/SDUI |
| **Iteration** | `REFINING` | User/Red-Team Feedback | Delta-updates to Model |
| **Realization** | `FINALIZED` | VE Approval | Decision-Grade Business Case |

#### Saga Safety: Action & Compensation Logic
Every agentic action is wrapped in a transactional envelope:
-   **Action()**: The primary operation (e.g., `UpdateValueTree`).
-   **Compensate()**: The rollback logic (e.g., `RevertToLastVersion`) triggered on failure or integrity veto.

#### Resilience Requirements
-   **Idempotency**: All agent requests must include an `idempotency-key` (UUID) to prevent duplicate model calculations during network retries.
-   **Resume-ability**: Workflow state is persisted in a durable store, allowing a VE to resume a multi-day discovery session without loss of context.

---

### 4. The Integrity Engine (Ground Truth Layer)
The Integrity Engine is the "Check and Balance" of ValueOS. It prevents the system from generating "hallucinated ROI."

#### Evidence Tiering & Provenance
ValueOS categorizes all supporting data into three tiers:
1.  **Tier 1 (Public/Primary)**: Direct data from EDGAR, 10-K/Q filings, or customer-provided spreadsheets.
2.  **Tier 2 (Market/Secondary)**: Gartner/Forrester research, industry-specific peer groups.
3.  **Tier 3 (Benchmarks)**: Proprietary internal historical data or anonymized aggregate indices.

#### The IntegrityAgent (Veto Logic)
Unlike a global guardrail, the `IntegrityAgent` provides **Component-Scoped Vetoes**. If a specific "Cost Savings" card fails a logic check (e.g., the saving exceeds the total addressable spend), the agent flags *only* that card for revision, rather than blocking the entire UI.

#### Confidence Scoring Methodology
Every claim is assigned a `ConfidenceScore` (0.0 - 1.0) based on:
-   **Data Freshness**: Age of the evidence.
-   **Source Reliability**: Tier 1 vs Tier 3.
-   **Logic Transparency**: Whether the formula can be decomposed into primitive inputs.

---

### 5. Agent Lifecycle & Execution Architecture
Agents are treated as first-class microservices with rigorous versioning and observability.

-   **Versioning**: Agent definitions (System Prompts, Temperature, Tool Access) and SDUI schemas use Semantic Versioning (SemVer). A model change in the `ModelingAgent` must not break the `ValueTreeCard` rendering in the frontend.
-   **Observability**: Every Value Case tracks:
    -   **Token Usage**: Cumulative and per-agent.
    -   **Cost Tracking**: Real-time USD cost per case.
    -   **Duration**: Latency of each step in the Saga.
-   **Failure Handling**: 
    -   **Circuit Breakers**: If an LLM provider has >10% error rate, the system fails over to a secondary model.
    -   **Dead-Letter Queues (DLQ)**: Failed agent tasks are moved to a DLQ for manual inspection by the Engineering team.

---

### 6. SDUI & UI Integration Strategy
ValueOS employs **Server-Driven UI (SDUI)** to ensure the interface can adapt dynamically to the agent's output without frontend deployments.

#### Component System Requirements
The system utilizes a library of high-fidelity, stateless components:
-   `DiscoveryCard`: Visualizes raw data ingestion.
-   `KPIForm`: Dynamic input fields for financial variables.
-   `ValueTreeCard`: An interactive SVG/Canvas visualization of the ROI math.
-   `NarrativeBlock`: Markdown-supported text with inline citations.

#### Performance Targets
-   **Fast Motion Content (FMC)**: The initial UI skeleton and cached data must render in **< 2 seconds**.
-   **Streaming Updates**: Agentic reasoning must stream to the UI in real-time using Server-Sent Events (SSE).

---

### 7. Enterprise Governance & Multi-Tenancy
ValueOS is built for the enterprise, ensuring strict data isolation and "Defensible AI."

-   **Multi-Tenancy**: Data is isolated via **Row-Level Security (RLS)**. Every database query is scoped by the `tenant_id` extracted from the user’s **JWT context**.
-   **Auditability**: An immutable log stores every change to a Value Case. Logs include:
    -   `correlation_id`: Linking the UI action to the backend agent logs.
    -   `diff`: A JSON-patch showing exactly what changed (e.g., ROI increased from 15% to 22%).
-   **The 'CFO Defence' Test**: Every calculated figure must be "explorable." Clicking a number in the UI must reveal its "Lineage"—the raw data source, the formula used, and the agent responsible for the calculation.

---

### 8. Go-Live 'Red Flag' Kill Criteria
The following conditions will trigger an immediate "No-Go" for production release:
1.  **Hidden Confidence**: Any financial claim presented without a confidence score or citation.
2.  **Silent Invalidation**: A change in an upstream variable that does not automatically trigger a re-validation of downstream narrative cards.
3.  **Math Hallucinations**: Any discrepancy between the LLM’s narrative and the programmatic calculation of the Value Tree.
4.  **Security Leakage**: Any instance where RLS fails to prevent cross-tenant data access in a staging environment.

---

### 9. Conclusion: The Final Gate Question
The ultimate success metric for ValueOS is not user engagement or token throughput. It is a single qualitative gate:

> **"Can a senior Value Engineer walk into a boardroom and defend a $10M claim using the ValueOS output without hand-waving or manual spreadsheet verification?"**

If the answer is anything less than a definitive "Yes," the workflow has not yet reached decision-grade maturity. ValueOS is built to ensure that "Yes."