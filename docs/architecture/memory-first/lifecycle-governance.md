# Memory-First: Lifecycle & Governance

## 1. End-to-End Lifecycle

The ValueOS lifecycle moves data through four key transitions:

1.  **Episodic → Semantic**: Raw artifacts (transcripts, PDFs) are decomposed into structured business claims (Facts).
2.  **Semantic → Computational**: Verified facts are used as variables in deterministic financial models.
3.  **Computational → Narrative**: Model outputs and cited facts are synthesized into executive documents.
4.  **Audit/Governance**: Every claim is mapped back to its source via the `FactEvidence` lineage.

## 2. Agent Governance

The `AgentFabric` enforces strict boundaries on agentic actions:

- **Authority Levels (1-5)**:
  - `Level 1-2`: Read-only or research (cannot commit truth).
  - `Level 3-4`: Business operations and financial modeling.
  - `Level 5`: System-level policy enforcement and Integrity veto.
- **PermissionGuard**: Physically blocks agents from writing to memory layers above their authority.

## 3. Approval & Access Workflow

- **ApprovalService**: Manages the promotion of `DRAFT` facts to `APPROVED` status.
- **AccessService**: Manages `Access Grants` for external stakeholders.
- **Guest Access**: Uses cryptographically secure tokens with automatic expiration and 3-tier permissions (`read_only`, `commenter`, `full_access`).

## 4. Trust Model Summary

- **Cryptographic Lineage**: SHA-256 hashing at every layer.
- **Deterministic Runs**: Hashed execution fingerprints.
- **Human-in-the-Loop**: Mandatory approval for "Source of Truth" promotion.

---

**Last Updated:** 2026-01-28
**Related:** `ValueOS Memory-First Architecture End-to-End Lifecycle Demonstration.md`, `ValueOS Agent Governance Framework with Permission Guards and Memory Persistence.md`
