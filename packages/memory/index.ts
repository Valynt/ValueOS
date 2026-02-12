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

// Semantic memory (facts, knowledge)
export * from "./semantic/index.js";

// Episodic memory (events, interactions)
export * from "./episodic/index.js";

// Vector store adapters
export * from "./vector/index.js";

// Provenance tracking
export * from "./provenance/index.js";

// Memory lifecycle (TTL, consolidation, promotion)
export * from "./lifecycle/index.js";
