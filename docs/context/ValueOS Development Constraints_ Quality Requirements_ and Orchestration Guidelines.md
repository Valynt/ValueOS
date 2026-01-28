### 8. DEVELOPMENT CONSTRAINTS

**8.1 Human Capital Requirements**
The complexity of the **Dual-Brain Architecture**—specifically the interplay between the non-deterministic Agent Fabric and the immutable Value Fabric—requires a specialized engineering squad. Generalist profiles are insufficient for the mathematical rigor of the **Economic Structure Ontology (ESO)**.

| Role | Count | Core Competencies |
| :--- | :--- | :--- |
| **Senior Full-Stack Engineer** | 3 | React 18.3 (Concurrent Rendering), TypeScript, PostgreSQL optimization, Supabase/GoTrue implementation. |
| **AI/Prompt Engineer** | 2 | LLM-MARL orchestration, chain-of-thought engineering, Together AI inference optimization, JSON-schema SDUI design. |
| **DevOps & Security Engineer** | 1 | OpenTelemetry/Jaeger pipelines, Supabase RLS auditing, CI/CD for agentic sandboxes, Terraform/IAC. |

**8.2 Financial Precision Mandate (`decimal.js`)**
To bridge the **Trust Gap**, ValueOS prohibits the use of standard IEEE-754 floating-point numbers for any calculation involving currency or KPI deltas. 
- **The Rule:** All financial logic, ROI modeling, and discount rate applications must utilize the `decimal.js` library.
- **Reasoning:** Standard JavaScript `number` types introduce rounding errors (e.g., `0.1 + 0.2 !== 0.3`) which undermine CFO confidence. 
- **Enforcement:** A custom ESLint rule shall fail any PR where arithmetic operators (`+`, `-`, `*`, `/`) are applied to variables tagged as `FinancialMetric`.

**8.3 Browser Targets**
ValueOS utilizes modern CSS features (Container Queries, Subgrid) and advanced JavaScript (Top-level await, WeakRefs for memory management). Consequently, the platform targets **Evergreen Browsers** exclusively:
- **Chrome/Edge:** 120+
- **Safari:** 17.2+ (Critical for glassmorphism performance)
- **Firefox:** 120+

---

### 9. QUALITY REQUIREMENTS

**9.1 Testing Targets**
Quality is not a post-process but a structural requirement of the **IntegrityAgent**.

1.  **Agent Fabric Unit Coverage (85%+):** Every agent (Coordinator, Target, etc.) must have mocked reasoning tests. We test the *logic path*, not just the output, to ensure agents aren't "guessing" correctly for the wrong reasons.
2.  **E2E Flow Testing (Playwright):** Automated suites must simulate the full lifecycle: *Discovery → Modeling → Realization*. 
3.  **VMRT Validation:** A specific test suite validates that every `Write` operation to the database has a corresponding **Value Modeling Reasoning Trace** hash in the audit log.

**9.2 Observability & Distributed Tracing**
Traditional logging is insufficient for multi-agent systems. We implement **OpenTelemetry** with **Jaeger** to visualize the "Reasoning Path."

- **Trace Spans:** Every agent handoff (e.g., Coordinator → TargetAgent) is a unique span.
- **Context Propagation:** Metadata including `tenant_id` and `reasoning_token_usage` is propagated across the trace.
- **Visualizing Cognition:** Engineers must be able to view the Jaeger waterfall to see exactly where an agent stalled or where the **IntegrityAgent** triggered a veto.

---

### 10. SPECIAL CONSIDERATIONS

**10.1 The ValueOS Manifesto**
The **IntegrityAgent** programmatically enforces these principles as "Policy-as-Code."

*   **The CFO is the Final Judge:** If a logic chain wouldn't pass a "Big Four" audit, it is rejected.
*   **Transparency over Polish:** A raw reasoning trace (VMRT) is more valuable than a high-fidelity chart with no provenance.
*   **Conservative Quantification:** Defaults must always target P25/P50 benchmarks; P90 "blue sky" scenarios require explicit SME override.
*   **Causal Attribution:** No ROI claim is permitted without a direct link to a capability intervention in the ESO.

**10.2 7-State AI Interaction Model**
The UI follows a deterministic state machine to manage user expectations during agentic "thinking" periods.

| State | UI Behavior | Intent |
| :--- | :--- | :--- |
| **Idle** | Indigo pulse / breathing. | System ready for intent. |
| **Clarify** | Amber glow on specific inputs. | Resolving ambiguity before planning. |
| **Plan** | Sequential task-card reveal. | Showing the "Reasoning Path" for approval. |
| **Execute** | Active progress ring / data beam. | Computation and API retrieval (SEC/BLS). |
| **Review** | Side-by-side sliding panes. | Human-in-the-loop verification of AI output. |
| **Finalize** | Lock icon / Success green. | Persistence to Value Fabric; VMRT hash generated. |
| **Resume** | Restoration banner. | Reconstituting state from previous session. |

**10.3 VMRT (Value Modeling Reasoning Trace)**
The VMRT is the technical solution to the "Black Box" problem. 
- **Requirement:** Every change to a financial driver must store a `reasoning_step` in a JSONB column within the `vos_audit_logs`.
- **Structure:** This includes the `prompt_id`, `model_version`, `ground_truth_source` (e.g., SEC Filing URL), and the `integrity_score` assigned by the IntegrityAgent.

**10.4 ESO (Economic Structure Ontology) Injection**
The **TargetAgent** does not "know" industries; it "ingests" them. Industry-specific logic (SaaS, Mfg, Health) is injected into the agent's context window via the ESO. This prevents the model from applying SaaS "Churn" logic to a Manufacturing "Throughput" business case.

---

### 11. ORCHESTRATION HINTS

**11.1 Typical Setup Commands**
To initialize the ValueOS environment, ensure `pnpm` is used to maintain strict dependency hoists.

```bash
# Install dependencies with strict lockfile
pnpm install

# Initialize local Supabase environment
supabase start

# Run Vite dev server with Agent Fabric hot-reloading
pnpm run dev
```

**11.2 Critical Review Points**
During code reviews, engineers must prioritize the following "High-Risk" areas:

1.  **IntegrityAgent Veto Logic:** Review any changes to `secureInvoke` wrappers. Ensure that no agent has direct `UPDATE` permissions to the `sof_outcomes` table without an IntegrityAgent signature.
2.  **RLS Policy Audit:** Every new table in the **Value Fabric** must have a corresponding Row-Level Security policy.
    > *Question for Reviewers:* "Does this query explicitly filter by `auth.uid()` and `tenant_id`, or does it rely on application-side logic?" (Application-side logic is a fail).
3.  **Decimal Serialization:** Ensure `decimal.js` objects are correctly serialized to strings before being sent via PostgREST to prevent precision loss during JSON parsing.

**11.3 Parallel Work Opportunities**
The **Dual-Brain Architecture** allows for decoupled development:
- **Stream A:** Frontend engineers can build the **SDUI Canvas** using static JSON schemas while the backend is in progress.
- **Stream B:** AI Engineers can refine prompt templates in the **Together AI Playground** independently of the React UI.