# ValueOS Architecture & Design Brief

### 1. PROJECT VISION

**1.1 The Trust Gap in B2B Sales**
In the current enterprise landscape, B2B sales suffer from a systemic **Trust Gap**. Legacy sales processes rely on static, error-prone spreadsheets or generative AI models prone to hallucination. When a vendor presents an ROI business case to a CFO, it is often viewed with skepticism due to lack of defensible data provenance. ValueOS bridges this gap by replacing probabilistic guesses with deterministic, benchmark-validated reasoning chains, ensuring every financial claim is auditable and grounded in high-fidelity economic data.

**1.2 The 'Outcome Era' Philosophy**
ValueOS is architected for the **Outcome Era**, a paradigm shift where enterprise value is no longer a post-sale afterthought but a pre-sale requirement. This philosophy dictates that software should not just provide features, but act as an **Executive Exoskeleton** that orchestrates value across the entire customer lifecycle. ValueOS moves from "selling software" to "orchestrating business outcomes" by making value realization a continuous, verifiable process.

**1.3 User Personas**

| Persona | Role | Primary Objective | Technical Requirement |
| :--- | :--- | :--- | :--- |
| **Primary (The Strategist)** | Value Engineer / Solutions Architect | Building high-fidelity, data-driven ROI models. | Access to deep-link VMRT logs and Economic Structure Ontology (ESO). |
| **Secondary (The Closer)** | Account Executive | Presenting value narratives to executive buyers. | SDUI Presenter mode and real-time scenario modeling. |
| **Tertiary (The Grower)** | Customer Success Manager | Proving realized value and identifying expansion. | Automated Actuals-vs-Target tracking and telemetry integration. |

**1.4 Measurable Success Metrics**
*   **Modeling Velocity (80% Reduction):** Time to generate a 10-K-aligned business case must drop from 10 hours to <2 hours via automated **Ground Truth Ingestion**.
*   **Audit Accuracy (100% VMRT):** Every financial driver must possess a **Value Modeling Reasoning Trace** hash stored in immutable audit trails.
*   **Win Rate Uplift (15% Increase):** Improving deal conversion through transparent, high-fidelity narrative generation via the **CommunicatorAgent**.
*   **Inference Latency (<1.5s):** Initial agentic task planning must be sub-two seconds to maintain user engagement.
*   **Data Provenance (Zero-Hallucination):** 100% of industry benchmarks must originate from whitelisted sources (SEC, BLS, Census) via **Ground Truth Inversion**.

---

### 2. TECHNICAL DECISIONS

**2.1 React 18.3 (Concurrent Rendering)**
The frontend utilizes React 18.3 to leverage **Concurrent Rendering** and the `useTransition` hook. This is critical because the Agent Fabric performs heavy background reasoning and SDUI schema updates. Concurrent rendering ensures the UI remains responsive at 60fps, prioritizing user interactions over complex DOM reconciliations during agentic "thinking" states.

**2.2 Vite 7.2 (Module Bundling)**
Vite 7.2 is selected for its superior Hot Module Replacement (HMR) and build performance. As the platform relies heavily on **Server-Driven UI (SDUI)**, the ability to instantly reflect schema changes during local development is non-negotiable for engineering velocity.

**2.3 Supabase / Postgres 15.8 (PostgREST & RLS)**
Supabase provides the **Value Fabric** backbone. PostgreSQL 15.8 offers:
*   **Row-Level Security (RLS):** Cryptographic isolation of tenant data at the database level.
*   **CDC (Change Data Capture):** Real-time synchronization between the Agent Fabric and the UI via WebSockets.
*   **PostgREST:** Low-latency, direct-to-database API access.

**2.4 Together AI (Inference Latency)**
To power the **Multi-Agent Reinforcement Learning (MARL)** loop, Together AI is utilized for its sub-second inference latency. By leveraging open-weights models like Llama 3.x, ValueOS avoids the high cost of proprietary models while maintaining the flexibility to fine-tune specific agent behaviors.

**2.5 decimal.js (Financial Precision)**
Standard JavaScript floating-point numbers are insufficient for high-stakes enterprise ROI modeling. `decimal.js` is implemented across the stack to ensure **arbitrary-precision decimal arithmetic**, preventing rounding errors that could compromise CFO confidence.

---

### 3. CORE FEATURES

| # | Feature | Phase | Description | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Ground Truth Ingestor** | P0 | Automated SEC/BLS data retrieval. | Data verified via source hash; no LLM hallucinations. |
| 2 | **7-Agent Fabric** | P0 | Multi-agent orchestration loop. | 100% success on Coordinator-to-Agent handoffs. |
| 3 | **VMRT Audit Logger** | P0 | JSONB reasoning trace for every metric. | ROI cards show "View Reasoning" button with full logs. |
| 4 | **SecureInvoke Wrapper** | P0 | Restricted agent write permissions. | Agents cannot write to DB without IntegrityAgent veto. |
| 5 | **ESO Schema** | P0 | Economic Structure Ontology mapping. | Support for 500+ industry-specific KPI nodes. |
| 6 | **SDUI Canvas** | P1 | Dynamic AI-driven interface composition. | UI updates via JSON schema without frontend deployment. |
| 7 | **Confidence Scoring** | P1 | Tiers 1-3 data provenance markers. | All metrics display certainty badges (High/Med/Low). |
| 8 | **Scenario Modeler** | P1 | Real-time sensitivity analysis (±X%). | Monte Carlo simulations execute in <2000ms. |
| 9 | **Multi-Currency Engine** | P1 | Global financial reconciliation. | Automatic conversion using ISO-4217 standards. |
| 10 | **VOS-PT-1 Logic** | P1 | Encrypted execution sandbox. | Reasoning occurs in memory; no PII leaks to LLM. |

---

### 4. ARCHITECTURE REQUIREMENTS

**4.1 The Dual-Brain Architecture**
The system is partitioned into two distinct environments to ensure both cognitive flexibility and data integrity:
1. **Agent Fabric (The Brain):** An ephemeral execution layer where the **7-Agent Taxonomy** (Coordinator, Opportunity, Target, Realization, Expansion, Integrity, Communicator) collaborate in an LLM-MARL loop.
2. **Value Fabric (The Memory):** A persistent, immutable ledger built on PostgreSQL that stores the **Economic Structure Ontology (ESO)** and the **Systemic Outcome Framework (SOF)**.

**4.2 Read-Reason-Write Cycle & Data Flow**
The core execution pattern follows a strict lifecycle to prevent data corruption. The **IntegrityAgent** acts as a hard veto point.

```text
[ USER INTENT ] 
       |
       v
[ COORDINATOR AGENT ] <--- [ READ: VALUE FABRIC ]
       |                         |
       v                         |
[ AGENT FABRIC SANDBOX ] --------+
       |
       | (Proposed Model)
       v
[ INTEGRITY AGENT VETO? ] ---- [ NO: FAIL/RETRY ]
       |
       | (YES: VALIDATED)
       v
[ VALUE FABRIC COMMITS ] ----> [ VMRT LOGS (AUDIT) ]
       |
       v
[ SUPABASE REALTIME ] -------> [ SDUI FRONTEND CANVAS ]
```

**4.3 API Design Patterns**
*   **PostgREST (Value Fabric):** Used for standard CRUD operations on the Value Fabric.
*   **REST / Streams (Agent Fabric):** Long-running agentic reasoning tasks utilize Server-Sent Events (SSE) to stream granular reasoning updates to the client.
*   **Authentication:** All API calls are secured via Supabase GoTrue (JWT) with mandatory `tenant_id` scoping.

---

### 5. INTEGRATIONS

ValueOS operates as a highly connected hub, ingesting macro-economic data and exporting validated business cases to systems of record.

| Service | Purpose | Connection Type | Implementation Detail |
| :--- | :--- | :--- | :--- |
| **SEC EDGAR** | Ingestion of 10-K/10-Q filings. | REST | Rate-limited polling with user-agent compliance. |
| **BLS (Labor Stats)** | Retrieval of labor costs/inflation benchmarks. | REST | Periodic caching of industry tables into ESO. |
| **US Census Bureau** | Population/industry segmentation data. | REST | Querying NAICS-based economic census API. |
| **Together AI** | Sub-second LLM inference for MARL loop. | WebSocket | Streaming inference via SSE for real-time updates. |
| **Supabase** | Core backend: Auth, DB, Real-time CDC. | REST | PostgREST for data access; WebSockets for state sync. |
| **Salesforce** | CRM synchronization for Opportunity data. | REST | Bi-directional mapping of ROI drivers. |
| **OpenTelemetry** | Distributed tracing for VMRT logs. | gRPC | Exporting agentic trace spans to monitoring backends. |

---

### 6. PERFORMANCE REQUIREMENTS

The ValueOS architecture is optimized for the **"Flow State"** of value engineers. High-latency systems lead to cognitive friction.

**6.1 Latency Targets**
1. **Initial Task Planning (<1.5s):** User intent input to Coordinator Agent presentation.
2. **Reasoning Stream (<100ms/token):** The perception of "live thinking" as agents generate reasoning chains.
3. **API Response (<200ms):** Maximum latency for standard CRUD operations via PostgREST.
4. **Page Load (<2s):** Full initial load of the SDUI Canvas.

**6.2 Scale and Throughput Targets**
*   **Concurrency:** Support for **10,000+ concurrent active sessions** without degradation.
*   **Dataset Volume:** Handle **million-row financial datasets per tenant** for granular tracking.
*   **Concurrent Transactions:** 500+ writes per second to the VMRT logs during peak collaborative modeling.

---

### 7. SECURITY REQUIREMENTS

ValueOS follows a **Zero-Trust Intelligence** model.

**7.1 Multi-tenancy Isolation (Supabase RLS)**
Data isolation is enforced at the database layer via **PostgreSQL Row-Level Security (RLS)**.
*   Every query is scoped by a cryptographic `tenant_id` from the user’s JWT.
*   Policies ensure even a compromised agent token cannot access other tenant data.

**7.2 The 'secureInvoke' Agent Pattern**
All state changes must pass through the `secureInvoke` wrapper:
1. **Read-Only Sandbox:** Agents operate in an ephemeral memory space.
2. **The Integrity Veto:** Proposals are submitted to the **IntegrityAgent**.
3. **Validation Logic:** IntegrityAgent checks against financial guardrails (e.g., "Profit Margin < 100%").
4. **Commitment:** Only `VALIDATED` signals permit SQL transactions.

**7.3 Data Protection & Privacy**
*   **PII Masking:** Local pre-processing layer masks PII before sending to Together AI.
*   **Encryption at Rest:** All data encrypted via **AES-256**.
*   **Encryption in Transit:** TLS 1.3 for all movement.

---

### 8. DEVELOPMENT CONSTRAINTS

**8.1 Human Capital Requirements**
The **Dual-Brain Architecture** requires a specialized engineering squad.

| Role | Count | Core Competencies |
| :--- | :--- | :--- |
| **Senior Full-Stack Engineer** | 3 | React 18.3, TypeScript, PostgreSQL optimization. |
| **AI/Prompt Engineer** | 2 | LLM-MARL orchestration, CoT engineering, SDUI design. |
| **DevOps & Security Engineer** | 1 | OpenTelemetry/Jaeger, Supabase RLS, CI/CD. |

**8.2 Financial Precision Mandate (`decimal.js`)**
All financial logic must utilize the `decimal.js` library.
*   **The Rule:** Standard arithmetic operators (`+`, `-`, `*`, `/`) are prohibited on variables tagged as `FinancialMetric`.
*   **Enforcement:** A custom ESLint rule shall fail any PR violating this constraint.

---

### 9. QUALITY REQUIREMENTS

**9.1 Testing Targets**
1. **Agent Fabric Unit Coverage (85%+):** Mocked reasoning tests to verify *logic paths*, not just outputs.
2. **E2E Flow Testing (Playwright):** Full lifecycle simulation from *Discovery* to *Realization*.
3. **VMRT Validation:** Ensuring every `Write` has a corresponding reasoning trace hash.

**9.2 Observability & Distributed Tracing**
Implementing **OpenTelemetry** with **Jaeger** to visualize the "Reasoning Path."
*   **Trace Spans:** Every agent handoff (e.g., Coordinator → TargetAgent) is a unique span.
*   **Context Propagation:** `tenant_id` and token usage are propagated across the trace.

---

### 10. SPECIAL CONSIDERATIONS

**10.1 The ValueOS Manifesto**
*   **The CFO is the Final Judge:** Logic chains must pass "Big Four" audit standards.
*   **Transparency over Polish:** Raw reasoning traces (VMRT) are prioritized over aesthetic charts.
*   **Conservative Quantification:** Defaults target P25/P50 benchmarks.
*   **Causal Attribution:** No ROI claim is permitted without a capability link in the ESO.

**10.2 7-State AI Interaction Model**

| State | UI Behavior | Intent |
| :--- | :--- | :--- |
| **Idle** | Indigo pulse / breathing. | System ready for intent. |
| **Clarify** | Amber glow on specific inputs. | Resolving ambiguity. |
| **Plan** | Sequential task-card reveal. | Showing the "Reasoning Path". |
| **Execute** | Active progress ring. | Computation and API retrieval. |
| **Review** | Side-by-side sliding panes. | Human-in-the-loop verification. |
| **Finalize** | Lock icon / Success green. | Persistence; VMRT hash generated. |
| **Resume** | Restoration banner. | Reconstituting session state. |

**10.3 VMRT (Value Modeling Reasoning Trace)**
Every change to a financial driver stores a `reasoning_step` in `vos_audit_logs`. This JSONB structure includes `prompt_id`, `model_version`, `ground_truth_source`, and the `integrity_score`.

---

### 11. ORCHESTRATION HINTS

**11.1 Typical Setup Commands**

```bash
# Install dependencies with strict lockfile
pnpm install

# Initialize local Supabase environment
supabase start

# Run Vite dev server with Agent Fabric hot-reloading
pnpm run dev
```

**11.2 Critical Review Points**
1. **IntegrityAgent Veto Logic:** Ensure no agent has direct `UPDATE` permissions to the `sof_outcomes` table without an IntegrityAgent signature.
2. **RLS Policy Audit:** Every new table must have a Row-Level Security policy filtering by `auth.uid()` and `tenant_id`.
3. **Decimal Serialization:** Ensure `decimal.js` objects are serialized to strings before PostgREST transport to prevent precision loss.

**11.3 Parallel Work Opportunities**
*   **Frontend:** Building **SDUI Canvas** components using static JSON schemas.
*   **AI Engineering:** Refining prompt templates in the **Together AI Playground** independently of the UI.