/**
 * WorkflowStateService Interface
 *
 * Defines the contract for workflow state management to avoid circular dependencies.
 * This interface can be used for dependency injection and mocking.
 */

import { WorkflowState } from '../../repositories/WorkflowStateRepository.js';

import type { SessionInitOptions } from './WorkflowStateService.js';

export type { SessionInitOptions };

export interface IWorkflowStateService {
  loadOrCreateSession(options: SessionInitOptions): Promise<{ sessionId: string; state: WorkflowState }>;
  saveWorkflowState(state: WorkflowState): Promise<void>;
  getWorkflowState(sessionId: string, tenantId: string): Promise<WorkflowState | null>;
  getSession(sessionId: string, tenantId: string): Promise<WorkflowState | null>;
  updateSessionStatus(sessionId: string, status: string, tenantId: string): Promise<void>;
  cleanupOldSessions(olderThanDays: number, tenantId: string): Promise<number>;
}

/**
 * Factory function to create WorkflowStateService instance
 * This avoids circular dependencies by creating the service on demand
 */
export interface WorkflowStateServiceFactory {
  createWorkflowStateService(): Promise<IWorkflowStateService>;
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
        const { WorkflowStateService } = await import('./WorkflowStateService');
        return new WorkflowStateService();
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
