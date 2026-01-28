# Memory-First: Core Services & Engines

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
