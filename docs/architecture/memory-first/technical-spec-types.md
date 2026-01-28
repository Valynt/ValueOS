# Memory-First: Technical Specification & Types

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
