/**
 * @valueos/shared - Runtime-agnostic shared utilities
 *
 * ALLOWED CONSUMERS:
 * - All packages
 * - All apps
 *
 * This is a LEAF package - cannot import from any other package.
 */

// Domain model (canonical domain objects and LifecycleStage)
export * from "./domain/index.js";

// Types and schemas
export * from "./types/index.js";
export * from "./schemas/index.js";
export * from "./constants/index.js"; // re-export USER_ROLES only once

// Core utilities
export * from "./lib/logger.js";
export * from "./lib/supabase.js";
export * from "./lib/env.js";
export * from "./lib/context.js";
export * from "./lib/piiFilter.js";
export * from "./lib/permissions.js";
export * from "./lib/redisClient.js";
export * from "./lib/redisKeys.js";

// Utilities
export * from "./lib/featureFlags.js";
export * from "./lib/SemanticMemory.js";

export * from "./observability/logSchema.js";
