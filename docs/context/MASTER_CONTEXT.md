# ValueOS Master Context

**Version:** 1.0.0
**Last Updated:** 2026-01-28
**Status:** Authoritative Source of Truth

---

## 1. Executive Summary

ValueOS is an **AI-native Customer Value Operating System (CVOS)** designed to bridge the "Trust Gap" in B2B sales. It replaces manual, error-prone spreadsheets with deterministic, benchmark-validated ROI orchestration. The platform uses a **Dual-Brain Architecture** to separate non-deterministic agentic reasoning from an immutable, auditable ledger of financial truth.

---

## 2. Core Architecture: The Dual-Brain

ValueOS is partitioned into two distinct environments:

1.  **Agent Fabric (The Brain):** An ephemeral execution layer where a **7-Agent Taxonomy** (Coordinator, Opportunity, Target, FinancialModeling, Realization, Expansion, Integrity, Communicator) collaborates in an LLM-MARL loop.
2.  **Value Fabric (The Memory):** A persistent, immutable ledger built on **PostgreSQL 15.8** (Supabase) that stores the **Economic Structure Ontology (ESO)** and the **Systemic Outcome Framework (SOF)**.

### Key Interaction Pattern: Read-Reason-Write

- Agents operate in a read-only sandbox.
- All state changes must pass through the `secureInvoke` wrapper.
- The **IntegrityAgent** acts as a hard veto point, validating proposals against financial guardrails before committing to the Value Fabric.

---

## 3. Technical Stack

| Layer             | Technology               | Critical Detail                                                    |
| :---------------- | :----------------------- | :----------------------------------------------------------------- |
| **Frontend**      | React 18.3 + Vite 7.2    | Concurrent Rendering for 60fps UI during agent reasoning.          |
| **Backend**       | Supabase (Postgres 15.8) | Row-Level Security (RLS) for cryptographic tenant isolation.       |
| **AI/LLM**        | Together AI              | Sub-second inference for MARL loops (Llama 3.x / Mixtral).         |
| **Precision**     | `decimal.js`             | Mandatory for all financial logic; IEEE-754 floats are prohibited. |
| **Observability** | OpenTelemetry + Jaeger   | Distributed tracing to visualize the "Reasoning Path."             |

---

## 4. Critical Systems & Requirements

### 4.1 VMRT (Value Modeling Reasoning Trace)

Every change to a financial driver must store a `reasoning_step` in a JSONB column within `vos_audit_logs`. This ensures 100% auditability of AI-generated claims.

### 4.2 Ground Truth Inversion

ValueOS eliminates hallucinations by flipping prompt logic:

1. Agent identifies a data need.
2. System executes a `GroundTruthLookup` against whitelisted sources (SEC EDGAR, BLS, Census).
3. Agent contextualizes the retrieved, verified data.

### 4.3 7-State UI Interaction Model

The UI follows a deterministic state machine: **Idle → Clarify → Plan → Execute → Review → Finalize → Resume**.

---

## 5. Directory Structure & Sub-Contexts

To maintain focus, detailed documentation is split into four specialized sub-docs:

1.  **[System Architecture & Agents](./system-architecture.md):** Deep dive into the 7-Agent Fabric, MARL orchestration, and authority levels.
2.  **[Data & Infrastructure](./data-infrastructure.md):** Database schema, RLS policies, Ground Truth Tiers (1-3), and DevContainer setup.
3.  **[Frontend & UX](./frontend-ux.md):** SDUI Canvas, component library, state management (Zustand), and the 7-state machine.
4.  **[Security & Compliance](./security-compliance.md):** Zero-Trust Intelligence, `secureInvoke` patterns, MFA, and audit logging.

---

## 6. Development Constraints

- **Financial Precision:** Use `decimal.js` for all currency/KPI math. Custom ESLint rules enforce this.
- **Tenant Isolation:** Every query must be scoped by `tenant_id` via RLS.
- **Browser Targets:** Evergreen browsers only (Chrome/Edge 120+, Safari 17.2+).
- **Testing:** 85%+ coverage for Agent Fabric; 100% for financial engines.

---

**Maintainer:** AI Implementation Team
**Related:** `ARCHITECTURE_DESIGN_BRIEF.md`, `SYSTEM_INVARIANTS.md`
