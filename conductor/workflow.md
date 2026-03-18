> **Superseded by [V1 Product Design Brief](../openspec/specs/v1-product-vision/spec.md)** — retained for historical reference.

# Workflow: Hypothesis-First Agentic Saga

ValueOS utilizes a domain-specific state machine and an iterative loop to drive Value Engineering cases.

## Saga States & Transitions
The Value Case lifecycle moves through the following phases:

1. **Discovery (`INITIATED`)**: Opportunity ID Ingest → Context Map & Pain Points.
2. **Modeling (`DRAFTING`)**: Hypothesis Confirmed → Financial Value Tree (JSON).
3. **Integrity (`VALIDATING`)**: Model Completion → Confidence Score & Citations.
4. **Narrative (`COMPOSING`)**: Integrity Check Pass → Executive Summary & SDUI.
5. **Iteration (`REFINING`)**: User/Red-Team Feedback → Delta-updates to Model.
6. **Realization (`FINALIZED`)**: VE Approval → Decision-Grade Business Case.

## The Core Loop
1. **Hypothesis**: Propose value drivers.
2. **Model**: Build the calculation (Value Tree).
3. **Evidence**: Fetch grounding data (EDGAR, 10-Ks).
4. **Narrative**: Translate math into a business story.
5. **Objection**: "Red Team" agent stress-tests the logic.
6. **Revision**: Auto-correct based on objections.
7. **Approval**: Human VE review and lock.

## Operational Principles
- **Idempotency**: All agent requests carry a UUID key to prevent duplicate calculations.
- **Resume-ability**: Workflow state is persisted for long-running discovery sessions.
- **Compensation**: Every action has a rollback logic (e.g., reverting to the last version of a Value Tree if integrity fails).
- **Auditability**: Immutable logs track every change with `correlation_id` and JSON patches.
