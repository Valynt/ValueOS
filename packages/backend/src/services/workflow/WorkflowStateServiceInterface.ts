/**
 * WorkflowStateService Interface
 *
 * Defines the contract for workflow state management to avoid circular dependencies.
 * This interface can be used for dependency injection and mocking.
 */

import { WorkflowState } from '../repositories/WorkflowStateRepository';

export interface SessionInitOptions {
  caseId: string;
  userId: string;
  tenantId: string;
  initialStage?: string;
  context?: Record<string, any>;
}

export interface IWorkflowStateService {
  /**
   * Load existing session or create new one
   * @param options Session initialization options
   * @returns Session ID and initial workflow state
   */
  loadOrCreateSession(options: SessionInitOptions): Promise<{ sessionId: string; state: WorkflowState }>;

  /**
   * Save workflow state to database
   * @param sessionId Session identifier
   * @param state Updated workflow state
   * @param tenantId Tenant identifier for multi-tenancy
   */
  saveWorkflowState(sessionId: string, state: WorkflowState, tenantId: string): Promise<void>;

  /**
   * Get active session for a specific case
   * @param userId User identifier
   * @param tenantId Tenant identifier
   * @param caseId Case identifier
   * @returns Session data or null if not found
   */
  getActiveSessionForCase(userId: string, tenantId: string, caseId: string): Promise<any>;

  /**
   * Create new session
   * @param userId User identifier
   * @param initialState Initial workflow state
   * @param tenantId Tenant identifier
   * @returns Session ID
   */
  createSession(userId: string, initialState: WorkflowState, tenantId: string): Promise<string>;
}

/**
 * Factory function to create WorkflowStateService instance
 * This avoids circular dependencies by creating the service on demand
 */
export interface WorkflowStateServiceFactory {
  createWorkflowStateService(): IWorkflowStateService;
}

/**
 * Global factory instance - can be mocked in tests
 */
let workflowStateServiceFactory: WorkflowStateServiceFactory;

/**
 * Set the factory for creating WorkflowStateService instances
 * Used for dependency injection and testing
 */
export function setWorkflowStateServiceFactory(factory: WorkflowStateServiceFactory): void {
  workflowStateServiceFactory = factory;
}

/**
 * Get the current factory or create default implementation
 */
export function getWorkflowStateServiceFactory(): WorkflowStateServiceFactory {
  if (!workflowStateServiceFactory) {
    // Default factory implementation
    workflowStateServiceFactory = {
      createWorkflowStateService: async () => {
        // Dynamic import to avoid circular dependency
        const { WorkflowStateService } = await import('./WorkflowStateService');
        const { supabase } = await import('../lib/supabase');
        return new WorkflowStateService(supabase);
      }
    };
  }
  return workflowStateServiceFactory;
}

/**
 * Convenience function to get a service instance
 */
export async function getWorkflowStateService(): Promise<IWorkflowStateService> {
  const factory = getWorkflowStateServiceFactory();
  return factory.createWorkflowStateService();
}
