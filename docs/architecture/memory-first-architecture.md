---
title: Memory First Architecture
owner: team-platform
system: valueos-platform
---

# Memory First Architecture

**Last Updated**: 2026-02-08

**Consolidated from 5 source documents**

---

## Table of Contents

1. [ValueOS Memory-First Architecture: Master Context](#valueos-memory-first-architecture:-master-context)
2. [Memory-First: Core Services & Engines](#memory-first:-core-services-&-engines)
3. [Memory-First: Database & SQL Schema](#memory-first:-database-&-sql-schema)
4. [Memory-First: Lifecycle & Governance](#memory-first:-lifecycle-&-governance)
5. [Memory-First: Technical Specification & Types](#memory-first:-technical-specification-&-types)

---

## ValueOS Memory-First Architecture: Master Context

*Source: `architecture/memory-first/MEMORY_FIRST_MASTER.md`*

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

---

## Memory-First: Core Services & Engines

*Source: `architecture/memory-first/core-services.md`*

## 1. Write Plane: MemoryPipeline

The `MemoryPipeline` is responsible for the ingestion and extraction of knowledge.

- **Idempotency**: Uses SHA-256 to prevent duplicate artifact processing.
- **Chunking**: Decomposes artifacts into manageable segments for vectorization.
- **Extraction**: Uses Together AI (Llama 3.x) to extract atomic facts and entities.

## 2. Read Plane: RetrievalEngine

The `RetrievalEngine` executes hybrid searches across episodic and semantic layers.

- **Hybrid Search**: Combines `pgvector` similarity with Postgres Full-Text Search.
- **Evidence Mapping**: Automatically links retrieved facts back to their original source chunks (Lineage).
- **Persona Scoping**: Ranks evidence based on the target persona (e.g., prioritizing quantitative facts for a CFO).

## 3. Computational Plane: ModelRunEngine

The `ModelRunEngine` executes deterministic value calculations.

- **Run Fingerprints**: Generates a unique hash of (`Inputs` + `Logic Version` + `Benchmark Slices`).
- **Immutability**: Ensures that if any input or formula changes, the audit trail reflects the drift.
- **Benchmark Integration**: Locks to specific "Slices" of industry data via the `BenchmarkService`.

## 4. Synthesis Plane: NarrativeEngine

The `NarrativeEngine` transforms raw data into human-readable value stories.

- **Persona Templates**: Injects model outputs and cited facts into persona-aligned templates.
- **Auditability**: Every claim in the narrative is mapped back to its `FactEvidence` lineage.

---

**Last Updated:** 2026-01-28
**Related:** `MemoryService Production-Grade TypeScript Implementation.md`, `ModelRunEngine Core Execution Framework for ValueOS.md`

---

## Memory-First: Database & SQL Schema

*Source: `architecture/memory-first/database-schema.md`*

## 1. Core Identity & Isolation

ValueOS uses a multi-tenant schema where every table is scoped by a `tenant_id`.

```sql
-- Tenant Isolation Helper
create or replace function public.get_tenant_id()
returns uuid language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;
```

## 2. Storage Layer Tables

- **`tenants`**: Corporate entity isolation.
- **`profiles`**: User roles (`admin`, `editor`, `viewer`, `guest`).
- **`value_cases`**: Deal containers with Full-Text Search (FTS).
- **`artifact_chunks`**: Vectorized segments (`vector(1536)`).
- **`entities` & `entity_edges`**: The Semantic Knowledge Graph.
- **`facts` & `fact_evidence`**: The Declarative Truth layer with provenance.
- **`model_runs`**: Computational audit logs.
- **`narratives`**: AI-generated reports.

## 3. Performance Indexing

### HNSW Vector Indexes

Optimized for cosine similarity search:

```sql
create index idx_artifact_chunks_embedding on public.artifact_chunks
using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);
```

### GIN Full-Text Search Indexes

```sql
create index idx_artifact_chunks_fts on public.artifact_chunks using gin(fts);
```

## 4. Hybrid Search Utility

The `hybrid_search_chunks` function combines Vector similarity and BM25/FTS ranking:

```sql
-- Returns combined_score = (similarity * semantic_weight) + (fts_rank * full_text_weight)
```

## 5. Row-Level Security (RLS)

RLS is enabled on all tables. The default policy ensures that users can only access data belonging to their `tenant_id` or resources explicitly shared via `access_grants`.

---

**Last Updated:** 2026-01-28
**Related:** `ValueOS Memory-First Architecture Migration SQL Schema.md`

---

## Memory-First: Lifecycle & Governance

*Source: `architecture/memory-first/lifecycle-governance.md`*

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

---

## Memory-First: Technical Specification & Types

*Source: `architecture/memory-first/technical-spec-types.md`*

## 1. The 5-Layer Data Model

ValueOS decomposes information into five distinct layers to ensure structural integrity and auditability.

### Layer 1: Episodic (Raw Inputs)

- **Artifacts**: Documents, Emails, Transcripts.
- **ArtifactChunks**: Atomic segments with 1536-dimension embeddings.
- **Idempotency**: SHA-256 hashing of content to prevent duplicates.

### Layer 2: Semantic (Knowledge Graph)

- **Entities**: People, Organizations, Products.
- **EntityEdges**: Relationships (e.g., `WORKS_AT`, `COMPETES_WITH`) with weights.

### Layer 3: Declarative (High-Fidelity Facts)

- **Facts**: Validated claims representing the "Source of Truth."
- **FactEvidence**: Lineage linking facts back to episodic chunks.
- **Status**: `DRAFT` → `APPROVED` → `DEPRECATED`.

### Layer 4: Computational (Model Runs)

- **ModelRuns**: Execution logs of AI model invocations.
- **Run Fingerprint**: Hash of (`Inputs` + `Logic Version` + `Benchmark Slices`).
- **ModelRunEvidence**: Facts cited during a specific run.

### Layer 5: Governance (Outputs & Audit)

- **Narratives**: Synthesized AI reports (CFO/VP Sales personas).
- **Approvals**: Audit trail for resource promotion.
- **AccessGrants**: Scoped, temporary access for external stakeholders.

## 2. Core TypeScript Interfaces

```typescript
export type UUID = string;
export type Vector1536 = number[];

export enum FactStatus {
  DRAFT = "draft",
  APPROVED = "approved",
  DEPRECATED = "deprecated",
}

export interface MemoryEnvelope<TInput = any, TOutput = any> {
  invocation_id: UUID;
  timestamp: Date;
  agent_id: string;
  input: TInput;
  output: TOutput;
  evidence_used: {
    facts: Fact[];
    chunks: ArtifactChunk[];
  };
  telemetry: {
    latency_ms: number;
    token_usage: { total: number };
    cost_usd: number;
  };
}

export interface HybridSearchResult {
  id: UUID;
  content: string;
  similarity: number;
  fts_rank: number;
  combined_score: number;
  citation_label?: string;
}
```

---

**Last Updated:** 2026-01-28
**Related:** `ValueOS Memory-First Architecture TypeScript Type Definitions.md`

---