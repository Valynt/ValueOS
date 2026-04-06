/**
 * @valueos/memory - Public API
 *
 * Memory layer for ValueOS - semantic, episodic, vector, provenance, lifecycle.
 *
 * ALLOWED CONSUMERS:
 * - packages/agents
 * - packages/backend
 *
 * FORBIDDEN CONSUMERS:
 * - apps/* (frontend)
 */

// Keep the bare package entry intentionally small.
// Full module surfaces remain available through the explicit subpath exports
// declared in package.json, e.g. @valueos/memory/provenance.
export type {
  SemanticFact,
  SemanticFactProvenance,
  SemanticFactStatus,
  SemanticFactType,
  SemanticStore,
} from "./semantic/index.js";

export type { VectorChunk, VectorStore } from "./vector/index.js";

export type { ProvenanceRecord } from "./provenance/index.js";
