# ValueOS Architecture & Design Brief: Technical Expansion Plan

### 1. PROJECT VISION
**Project Name:** ValueOS
**One-Line Description:** An AI-native Customer Value Operating System (CVOS) that transforms enterprise sales from feature-based pitching to deterministic, benchmark-validated ROI orchestration.

**Target Users:**
*   **Primary (The Strategist):** Value Engineers & Solutions Architects building complex business cases.
*   **Secondary (The Closer):** Account Executives presenting high-stakes narratives to CFOs.
*   **Tertiary (The Grower):** Customer Success Managers proving realized value for renewals.

**Core Problem:** The "Trust Gap" in B2B sales caused by non-defensible ROI spreadsheets and AI hallucinations in financial modeling.

**Success Metrics:**
1.  **Modeling Velocity:** 80% reduction in time to build a 10-K-aligned business case.
2.  **Audit Accuracy:** 100% of financial claims backed by a VMRT (Value Modeling Reasoning Trace).
3.  **Win Rate Uplift:** 15% increase in competitive win rates via transparent value-based storytelling.
4.  **Churn Reduction:** 20% improvement in renewal rates through automated "Actuals vs. Target" tracking.

---

### 2. TECHNICAL DECISIONS
| Layer | Choice | Rationale |
| :--- | :--- | :--- |
| **Frontend** | **React 18.3 + Vite 7.2** | Utilizes *Concurrent Rendering* and `useTransition` to maintain 60fps UI responsiveness during heavy Agent Fabric background reasoning. |
| **Backend** | **Supabase (Postgres 15.8)** | Leverages **Row-Level Security (RLS)** for cryptographic tenant isolation and Realtime CDC for the "Dual-Brain" synchronization. |
| **AI/LLM** | **Together AI** | Provides sub-second inference latency for Multi-Agent Reinforcement Learning (MARL) using open-weights models (Llama 3.x / Mixtral). |
| **Logic** | **decimal.js** | Critical for financial precision; prevents floating-point errors in high-stakes ROI calculations. |
| **State** | **Zustand** | Minimalist store for managing the 7-State UI machine transitions without the overhead of Redux. |

---

### 3. CORE FEATURES
| # | Feature | Phase | Description | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Ground Truth Ingestor** | P0 | Inverts LLM logic by pulling data from SEC/BLS. | Data verified via source hash; no LLM-generated numbers. |
| 2 | **7-Agent Fabric** | P0 | Orchestrates MARL interaction for discovery. | Successful handoff from Coordinator to IntegrityAgent. |
| 3 | **VMRT Logger** | P0 | Captures the full reasoning trace of any metric. | Every ROI card has a "View Reasoning" audit trail. |
| 4 | **SDUI Canvas** | P1 | Server-Driven UI for dynamic data mapping. | UI updates via JSON schema without frontend deploy. |
| 5 | **Confidence Scoring** | P1 | Tiers 1-3 scoring based on data provenance. | Metrics display "High/Med/Low" certainty badges. |
| 6 | **Scenario Modeler** | P1 | Real-time sensitivity analysis (±X%). | Monte Carlo simulations run in <2 seconds. |
| 7 | **Auto-QBR Generator** | P2 | RealizationAgent identifies KPI gaps. | One-click export of actuals vs. promised value. |
| 8 | **GTM Strategy Bot** | P2 | ExpansionAgent flags upsell opportunities. | Identified gaps trigger "Strategy Cards" in CRM. |

---

### 4. ARCHITECTURE REQUIREMENTS

**The Dual-Brain Interaction Pattern:**
The architecture separates **Cognitive Reasoning (Agent Fabric)** from **Persistent Truth (Value Fabric)**.

1.  **Agent Fabric (The Brain):** An ephemeral execution layer where 7 agents collaborate. It uses the `Read-Reason-Write` cycle.
2.  **Value Fabric (The Memory):** A structured, immutable ledger (PostgreSQL) containing the Economic Structure Ontology (ESO).

**Data Flow Diagram:**
```text
[User Intent] -> [CoordinatorAgent] -> [Agent Fabric Sandbox]
                         |                      ^
                         v                      |
               [IntegrityAgent Veto?] <---- [Reasoning Trace]
                         |                      |
                         +----[VALIDATED]------>+
                                                |
[Value Fabric (DB)] <--- [Encrypted Commit] <---+
        |
        +----[Realtime Update]----> [SDUI Frontend]
```

---

### 5. INTEGRATIONS
| Service | Purpose | API Type |
| :--- | :--- | :--- |
| **Together AI** | High-speed MARL inference. | REST / Stream |
| **SEC EDGAR** | 10-K / 10-Q financial baseline ingestion. | REST |
| **BLS / Census** | Labor rates and industry benchmarks. | REST |
| **Salesforce/HubSpot** | Mapping discovery notes to ROI hypotheses. | OAuth2 / Webhooks |
| **OpenTelemetry** | Agent performance and trace monitoring. | gRPC |

---

### 6. PERFORMANCE REQUIREMENTS
*   **Agent Reasoning Latency:** Initial task planning < 1.5s; full model generation < 8s.
*   **UI Interaction:** 7-State transitions (e.g., *Plan* to *Execute*) must trigger visual feedback in < 100ms.
*   **Concurrency:** Support 5,000+ simultaneous agentic threads per cluster.
*   **Data Consistency:** Real-time sync between Value Fabric and UI < 200ms via Supabase Realtime.

---

### 7. SECURITY REQUIREMENTS

**Row-Level Security (RLS) Implementation:**
Every table in the Value Fabric includes a `tenant_id` column. The Supabase middleware enforces isolation at the database level:
```sql
CREATE POLICY "Tenant Isolation" ON value_fabric
FOR ALL USING (tenant_id = auth.uid_tenant_id());
```

**Agent Invocation Security:**
*   **SecureInvoke Pattern:** Agents never have direct DB write access. They submit "Commit Proposals" to a validation service.
*   **Data Masking:** PII is scrubbed before being sent to Together AI inference endpoints.

---

### 8. DEVELOPMENT CONSTRAINTS
*   **Precision Requirement:** All financial calculations must utilize `decimal.js` at the application level and `NUMERIC` types in Postgres.
*   **Browser Support:** Optimized for Chrome/Edge (Chromium) due to heavy Canvas and Web Worker usage.
*   **Auditability:** No metric can be persisted to the Value Fabric without an associated `vmrt_hash`.

---

### 9. QUALITY REQUIREMENTS
*   **Test Coverage:** 90% for the Agent Fabric logic; 100% for the financial calculation engine.
*   **Observability:** Full tracing via Jaeger to visualize Agent-to-Agent communication (The MARL Handoff).
*   **Hallucination Check:** IntegrityAgent must run a "Ground Truth Inversion" check on 100% of external data citations.

---

### 10. SPECIAL CONSIDERATIONS

#### 10.1 Ground Truth Inversion Logic
ValueOS eliminates hallucination by flipping the prompt logic. 
*   **Traditional AI:** "What is the average revenue per employee for Company X?" (High hallucination risk).
*   **ValueOS Inversion:**
    1. Agent Fabric identifies the *need* for revenue per employee.
    2. System executes a `GroundTruthLookup` against whitelisted SEC data.
    3. Agent Fabric *contextualizes* the retrieved number (e.g., "$240k/employee") into the ROI model.

#### 10.2 The 7-State UI Machine
The frontend is a state machine mapping to the Agent's cognitive state:
1.  **Idle:** Breathing indigo pulse (`#6366F1`).
2.  **Clarify:** Amber glow; UI interrupts to resolve ambiguity.
3.  **Plan:** Staggered card reveal showing intended agent steps.
4.  **Execute:** Active scanning beam animation.
5.  **Review:** Side-by-side diff visualization (Human vs. Agent).
6.  **Finalize:** Success check; persistence to Value Fabric.
7.  **Resume:** Context restoration from local cache + VMRT.

#### 10.3 VMRT (Value Modeling Reasoning Trace) Structure
The VMRT is a JSONB audit trail stored for every ROI driver:
```json
{
  "metric_id": "m_123",
  "reasoning_steps": [
    {"step": 1, "agent": "OpportunityAgent", "action": "Identified labor cost inefficiency"},
    {"step": 2, "agent": "IntegrityAgent", "source": "BLS 2024 Table 1.2", "val": 45.50}
  ],
  "confidence_score": 0.98,
  "verification_hash": "sha256:..."
}
```

---

### 11. ORCHESTRATION HINTS

**Critical Review Points:**
*   **The Integrity Veto:** Ensure the `IntegrityAgent` can programmatically block the `CoordinatorAgent` if the VMRT fails validation.
*   **Supabase RLS Leaks:** Audit all new tables to ensure no public access policies are accidentally enabled.
*   **Decimal Precision:** Mandatory review of all Math operations to ensure no native JS `number` types are used for currency.

**Parallel Work Opportunities:**
*   **Stream A:** Frontend development of the 7-State UI machine using mock JSON.
*   **Stream B:** Backend Economic Structure Ontology (ESO) schema design in Supabase.
*   **Stream C:** Prompt engineering for the 7-Agent MARL loop via Together AI.

**Setup Commands:**
```bash
# Initialize development environment
npm install decimal.js zustand @radix-ui/react-slot
supabase init
# Start local agent fabric emulator
npm run dev:agents
```