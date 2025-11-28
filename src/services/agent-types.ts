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
 * - Analysis: system-mapper, value-mapping, company-intelligence
 * - Design: intervention-designer, outcome-engineer
 * - Financial: financial-modeling
 * - Coordination: coordinator, value-eval, communicator
 */
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
  | 'communicator';

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
