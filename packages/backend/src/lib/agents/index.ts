/**
 * Agent runtime library — migrated from @valueos/agents package in Sprint 2.
 *
 * Canonical location: packages/backend/src/lib/agents/
 * The @valueos/agents workspace package was deleted in Sprint 2.
 *
 * Consumers within packages/backend should import from this path:
 *   import { ... } from '../lib/agents/index.js'
 *   import { ... } from '../lib/agents/orchestration/index.js'
 */

export * from './core/index.js';
export * from './orchestration/index.js';
