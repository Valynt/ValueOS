/**
 * @valueos/infra - Public API
 *
 * Infrastructure adapters for ValueOS.
 *
 * ALLOWED CONSUMERS:
 * - packages/memory
 * - packages/backend
 *
 * FORBIDDEN CONSUMERS:
 * - packages/agents (use memory instead)
 * - apps/* (frontend)
 */

// Supabase (auth, database, storage)
export * from "./supabase/index.js";

// Database adapters
export * from "./database/index.js";

// Message queues
export * from "./queues/index.js";

// File/blob storage
export * from "./storage/index.js";

// Observability (logging, metrics, tracing)
export * from "./observability/index.js";
