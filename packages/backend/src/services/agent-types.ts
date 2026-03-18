/**
 * Shared Agent Types
 * 
 * CONSOLIDATION: This file defines the canonical AgentType union.
 * All agent type definitions should reference this file.
 * 
 * Extracted to avoid circular dependencies between AgentAPI and AgentAuditLogger
 */

/**
 * Agent types supported by the system
 * 
 * Categories:
 * - VOS Lifecycle: opportunity, target, realization, expansion, integrity
 * - Research: research, benchmark, company-intelligence
 * - Analysis: system-mapper, value-mapping
 * - Design: intervention-designer, outcome-engineer
 * - Financial: financial-modeling
 * - Communication: communicator, narrative
 * - Coordination: coordinator, value-eval
 */
export type { AgentState, AgentEvent } from '../lib/agent/types';

export type AgentType =
  | 'opportunity'
  | 'target'
  | 'realization'
  | 'expansion'
  | 'integrity'
  | 'company-intelligence'
  | 'financial-modeling'
  | 'value-mapping'
  // Added during consolidation
  | 'system-mapper'
  | 'intervention-designer'
  | 'outcome-engineer'
  | 'coordinator'
  | 'value-eval'
  | 'communicator'
  // New agents (roadmap implementation)
  | 'research'
  | 'benchmark'
  | 'narrative'
  | 'groundtruth'
  | 'compliance-auditor';

/** Runtime array of all valid AgentType values. */
export const AgentType = [
  'opportunity',
  'target',
  'realization',
  'expansion',
  'integrity',
  'company-intelligence',
  'financial-modeling',
  'value-mapping',
  'system-mapper',
  'intervention-designer',
  'outcome-engineer',
  'coordinator',
  'value-eval',
  'communicator',
  'research',
  'benchmark',
  'narrative',
  'groundtruth',
  'compliance-auditor',
] as const;

/**
 * Agent request context
 */
export interface AgentContext {
  /**
   * User ID making the request
   */
  userId?: string;

  /**
   * Organization ID
   */
  organizationId?: string;

  /**
   * Session ID for tracking
   */
  sessionId?: string;

  /**
   * Additional context data
   */
  metadata?: Record<string, any>;
}
