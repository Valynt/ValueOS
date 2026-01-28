# ValueOS Memory-First Architecture: Master Context

**Version:** 1.0.0
**Last Updated:** 2026-01-28
**Status:** Authoritative Technical Specification

---

## 1. Executive Overview

The **Memory-First Architecture** is the foundational philosophy of ValueOS. It posits that enterprise intelligence resides not in the LLM, but in the **persistent, structured context** it maintains. Unlike stateless RAG systems, ValueOS treats memory as a multi-dimensional asset that drives reasoning, auditing, and value realization.

### The Core Thesis

- **Memory as Primary Asset**: Information is decomposed into distinct layers of "Truth."
- **Cryptographic Lineage**: Every claim is traceable back to a specific timestamp, document, and human approval via SHA-256 hashing.
- **Deterministic Reasoning**: Computational logic is versioned and hashed to prevent "organizational amnesia" and silent data drift.

---

## 2. The Five Memory Planes

ValueOS organizes knowledge into five specialized planes:

1.  **Episodic Memory**: "What happened"—Chronological stream of raw artifacts (emails, transcripts, PDFs) and system events.
2.  **Semantic Memory**: "What it means"—The Knowledge Graph of entities (People, Orgs) and their inter-relationships.
3.  **Declarative Memory**: "The Truth"—Curated, versioned facts that represent the authoritative source of truth for a tenant.
4.  **Computational Memory**: "How it's calculated"—Immutable logs of AI calculations, model runs, and benchmark snapshots.
5.  **Governance Memory**: "Who & Why"—Narratives, approvals, access grants, and audit trails for human consumption.

---

## 3. Architectural Blueprint

The system follows a **Logic Plane over Storage Plane** design:

- **Write Plane (Ingestion)**: `MemoryPipeline` handles idempotency, chunking, and extraction.
- **Storage Plane**: Supabase/Postgres with `pgvector` for hybrid search (Vector + FTS).
- **Read Plane (Retrieval)**: `RetrievalEngine` maps facts to original sources (Lineage).
- **Execution Plane**: `ModelRunEngine` and `AgentFabric` orchestrate deterministic value calculations.

---

## 4. Sub-Contexts & Specialized Docs

Detailed implementation details are consolidated into the following specialized documents:

1.  **[Technical Specification & Types](./technical-spec-types.md)**: TypeScript definitions, core interfaces, and the 5-layer data model.
2.  **[Database & SQL Schema](./database-schema.md)**: Production-ready SQL, RLS policies, HNSW indexes, and hybrid search utilities.
3.  **[Core Services & Engines](./core-services.md)**: Implementation details for `MemoryService`, `RetrievalEngine`, `ModelRunEngine`, and `NarrativeEngine`.
4.  **[Lifecycle & Governance](./lifecycle-governance.md)**: End-to-end lifecycle demo, agent authority levels, and the approval/access workflow.

---

## 5. Trust & Provenance Model

- **Idempotency**: SHA-256 hashing prevents duplicate processing.
- **Run Fingerprints**: `ModelRunEngine` hashes (Inputs + Logic Version + Benchmarks) to ensure auditability.
- **Fact-Evidence Link**: Every `Fact` is linked to an `artifact_chunk` for 1-click source verification.
- **Authority Boundaries**: `PermissionGuard` enforces authority levels (1-5) on all memory writes.

---

**Maintainer:** AI Implementation Team
**Related:** `docs/context/MASTER_CONTEXT.md`, `docs/architecture/overview.md`
