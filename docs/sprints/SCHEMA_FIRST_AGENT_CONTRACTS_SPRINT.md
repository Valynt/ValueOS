# Sprint Plan: Schema-First Agent Contracts & Output Compliance

**Objective:** Transition ValueOS from a "generate and interpret" architecture to a "schema-first, contract-bound" architecture. This sprint implements strict typed contracts between agents, enforces JSON-only outputs in critical paths, and introduces an Output Compliance Engine to guarantee deterministic, CFO-defensible outputs.

**Reference Documents:**
- `pasted_content.txt` (Output Formatting Strategies)
- `pasted_content_2.txt` (Production-Ready Agent Contract Spec)

---

## Sprint Overview

This sprint is broken down into 4 sequential epics. The goal is to establish the core primitives first, enforce them at the agent execution layer, and then migrate the specific ValueOS agents to the new contract system.

| Epic | Focus | Estimated Effort |
|---|---|---|
| **Epic 1** | Core Primitives & Contract Types | 2 Days |
| **Epic 2** | Output Compliance Engine & Retry Loops | 3 Days |
| **Epic 3** | Agent Migration (Financial & Integrity) | 3 Days |
| **Epic 4** | Agent Migration (Opportunity & Narrative) | 2 Days |

---

## Epic 1: Core Primitives & Contract Types

**Goal:** Define the foundational Zod schemas and TypeScript interfaces that will serve as the strict contracts between agents.

### Task 1.1: Define Shared Domain Primitives
- **Location:** `packages/backend/src/types/value-modeling.ts` (or new `domain-primitives.ts`)
- **Action:** Implement Zod schemas and TS types for:
  - `EvidenceRef` (CRM, transcript, benchmark, etc.)
  - `Assumption` (baseline, improvement, cost, risk)
  - `Stakeholder` (economic buyer, champion, etc.)
  - `ConfidenceScore` (score, basis, explanation)
- **Acceptance Criteria:** All primitives have strict Zod validation with `.strict()` to reject unknown fields.

### Task 2.2: Define Agent Contract Interfaces
- **Location:** `packages/backend/src/services/agents/core/AgentContract.ts`
- **Action:** Implement the canonical agent contract interfaces:
  - `AgentExecutionContext` (traceId, stage, model)
  - `AgentPolicy` (requireStructuredOutput, maxRetries, repairOnFailure)
  - `AgentResultMeta` (duration, validationPassed, retryCount)
  - `AgentResult<TOutput>`
  - `AgentContract<TInput, TOutput>`
- **Acceptance Criteria:** Interfaces match the spec provided in the design document.

### Task 1.3: Define Stage-Specific Schemas
- **Location:** `packages/backend/src/types/agent-schemas.ts`
- **Action:** Implement the input/output schemas for the core workflow stages:
  - `OpportunityContext` (INITIATED stage)
  - `ValueHypothesisDraft` (DRAFTING stage)
  - `FinancialModel` (FINANCIAL stage)
  - `IntegrityAssessment` (VALIDATING stage)
  - `ExecutiveNarrative` (COMPOSING stage)
- **Acceptance Criteria:** Schemas are fully typed and exported for use by the Compliance Engine.

---

## Epic 2: Output Compliance Engine & Retry Loops

**Goal:** Build the infrastructure that enforces the contracts, validates outputs, and automatically repairs malformed JSON.

### Task 2.1: Implement Output Compliance Engine
- **Location:** `packages/backend/src/services/agents/compliance/OutputComplianceEngine.ts`
- **Action:** Create a service that takes an LLM output string and an `AgentContract`.
  - Parse JSON strictly (rejecting markdown/prose).
  - Validate against the contract's Zod schema.
  - Run business logic rules (e.g., `if confidence > 0.8 require evidence`).
- **Acceptance Criteria:** Engine returns a typed `AgentResult` or throws specific validation errors (`SCHEMA_VALIDATION_FAILED`, `MISSING_EVIDENCE`).

### Task 2.2: Implement Repair & Retry Loop
- **Location:** `packages/backend/src/services/agents/resilience/AgentRetryManager.ts` (Update existing)
- **Action:** Integrate the Compliance Engine into the execution flow.
  - If validation fails, trigger a repair prompt: *"Return only a valid object matching the provided schema. Do not add explanation..."*
  - Implement the `Generate -> Validate -> Repair -> Retry -> Approve/Reject` loop.
- **Acceptance Criteria:** Malformed JSON is automatically repaired up to `maxRetries` before failing the workflow.

### Task 2.3: Update AgentExecutorService
- **Location:** `packages/backend/src/services/agents/AgentExecutorService.ts`
- **Action:** Modify the executor to use the new `AgentContract` flow instead of the legacy `AgentOutput` format. Ensure `contractVersion` and `traceId` are propagated.
- **Acceptance Criteria:** Executor successfully runs a dummy contract-bound agent.

---

## Epic 3: Agent Migration (Strict Path)

**Goal:** Migrate the most critical, math-heavy agents to the new strict JSON-only contracts.

### Task 3.1: Migrate FinancialModelingAgent
- **Location:** `packages/backend/src/services/agents/implementations/FinancialModelingAgent.ts`
- **Action:** 
  - Bind to `ValueHypothesisDraft` input and `FinancialModel` output schemas.
  - Update system prompt to enforce JSON-only mode.
  - Provide 1-2 canonical JSON examples in the prompt (Few-Shot).
- **Acceptance Criteria:** Agent reliably produces valid ROI math without prose.

### Task 3.2: Migrate IntegrityAgent
- **Location:** `packages/backend/src/services/agents/implementations/IntegrityAgent.ts`
- **Action:**
  - Bind to `ValueHypothesisDraft` + `FinancialModel` inputs and `IntegrityAssessment` output.
  - Implement strict governance rules (e.g., rejecting high-confidence guesses).
- **Acceptance Criteria:** Agent correctly flags missing evidence and outputs structured validation results.

---

## Epic 4: Agent Migration (Context & Narrative)

**Goal:** Migrate the remaining agents, ensuring clear separation between system data and human-readable output.

### Task 4.1: Migrate OpportunityAgent
- **Location:** `packages/backend/src/services/agents/implementations/OpportunityAgent.ts`
- **Action:**
  - Bind to raw inputs and `OpportunityContext` output.
  - Ensure it normalizes CRM data into the strict schema.
- **Acceptance Criteria:** Agent outputs structured context, eliminating downstream hallucinations.

### Task 4.2: Migrate NarrativeAgent
- **Location:** `packages/backend/src/services/agents/implementations/NarrativeAgent.ts`
- **Action:**
  - Bind to `FinalizedValueCase` input and `ExecutiveNarrative` output.
  - **Crucial:** This agent is allowed to output Markdown, but its *input* must be strictly validated structured data. It acts as a renderer, not a reasoner.
- **Acceptance Criteria:** Agent generates executive summaries based *only* on the structured input.

### Task 4.3: UI Rendering Updates (SDUI Adapter)
- **Location:** `packages/backend/src/services/agents/AgentSDUIAdapter.ts`
- **Action:** Update the adapter to consume the new `AgentResult<T>` structures instead of parsing raw LLM text.
- **Acceptance Criteria:** UI correctly renders the structured data (tables for ROI, markdown for narrative).

---

## Definition of Done for the Sprint

1. **Zero Prose in Critical Paths:** `FinancialModelingAgent` and `IntegrityAgent` never return markdown or conversational text.
2. **Deterministic Validation:** The `OutputComplianceEngine` catches 100% of schema violations and missing evidence rules.
3. **Auto-Repair:** The system successfully repairs minor JSON formatting errors (e.g., trailing commas, missing quotes) without human intervention.
4. **Traceability:** Every agent output includes `contractVersion`, `traceId`, and `confidence` scores.
5. **Tests:** All new contracts and the compliance engine have unit tests that *fail first* when rules are violated, ensuring 100% alignment with intended behavior.
