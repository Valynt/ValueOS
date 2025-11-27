/**
 * Shared Agent Types
 * 
 * Extracted to avoid circular dependencies between AgentAPI and AgentAuditLogger
 */

/**
 * Agent types supported by the system
 */
export type AgentType =
  | 'opportunity'
  | 'target'
  | 'realization'
  | 'expansion'
  | 'integrity'
  | 'company-intelligence'
  | 'financial-modeling'
  | 'value-mapping';

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
