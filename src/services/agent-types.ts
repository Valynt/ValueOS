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
  | 'outcome-engineer';

/**
 * Agent request context
 */
export interface AgentContext {
  /**
   * User ID making the request
   */
  userId: string;

  /**
   * Tenant ID for multi-tenancy
   */
  tenantId?: string;

  /**
   * Session ID for tracking
   */
  sessionId?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}
