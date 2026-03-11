/**
 * Workflow State Service
 *
 * Client-side bridge to WorkflowStateRepository for chat workflows.
 * Provides session management and state persistence for ChatCanvas.
 *
 * Architecture:
 * - Separates UI concerns from persistence logic
 * - Handles session lifecycle (create, load, save, cleanup)
 * - Provides real-time state updates via subscriptions
 */

import { logger } from '../../lib/logger.js';
import { WorkflowState, WorkflowStateRepository, WorkflowStatus } from '../../repositories/WorkflowStateRepository.js';

export interface SessionInitOptions {
  caseId: string;
  userId: string;
  tenantId: string;
  initialStage?: string;
  context?: Record<string, unknown>;
}

export type StateChangeCallback = (state: WorkflowState) => void;

export class WorkflowStateService {
  private repository: WorkflowStateRepository;
  private subscriptions: Map<string, Set<StateChangeCallback>> = new Map();

  constructor() {
    this.repository = new WorkflowStateRepository();
  }

  async loadOrCreateSession(
    options: SessionInitOptions,
  ): Promise<{ sessionId: string; state: WorkflowState }> {
    const { caseId, userId, tenantId, initialStage = 'discovery', context = {} } = options;

    try {
      const existingSession = await this.repository.getActiveSessionForCase(caseId, tenantId);

      if (existingSession) {
        logger.info('Resuming existing session', { sessionId: existingSession.id, caseId });
        return { sessionId: existingSession.id, state: existingSession };
      }

      logger.info('Creating new session', { caseId, userId, initialStage });

      const session = await this.repository.createSession({
        userId,
        organizationId: tenantId,
        initialStage,
      });

      // Merge caller-supplied context into the persisted state
      if (Object.keys(context).length > 0) {
        const updated = await this.repository.update(session.id, tenantId, {
          context: { ...session.context, ...context, caseId },
        });
        return { sessionId: updated.id, state: updated };
      }

      return { sessionId: session.id, state: session };
    } catch (error) {
      logger.error('Failed to load/create session', error instanceof Error ? error : undefined, {
        caseId,
        userId,
      });
      throw new Error('Failed to initialize workflow session');
    }
  }

  async saveWorkflowState(state: WorkflowState): Promise<void> {
    try {
      await this.repository.saveState(state);
      logger.debug('Workflow state saved', { sessionId: state.id, stage: state.currentStage, status: state.status });
      this.notifySubscribers(state.id, state);
    } catch (error) {
      logger.error('Failed to save workflow state', error instanceof Error ? error : undefined, {
        sessionId: state.id,
      });
      throw error;
    }
  }

  async getWorkflowState(sessionId: string, tenantId: string): Promise<WorkflowState | null> {
    try {
      return await this.repository.getState(sessionId, tenantId);
    } catch (error) {
      logger.error('Failed to get workflow state', error instanceof Error ? error : undefined, { sessionId });
      return null;
    }
  }

  async getSession(sessionId: string, tenantId: string): Promise<WorkflowState | null> {
    try {
      return await this.repository.getSession(sessionId, tenantId);
    } catch (error) {
      logger.error('Failed to get session', error instanceof Error ? error : undefined, { sessionId });
      return null;
    }
  }

  async updateSessionStatus(
    sessionId: string,
    status: WorkflowStatus,
    tenantId: string,
  ): Promise<void> {
    try {
      await this.repository.updateSessionStatus(sessionId, status, tenantId);
      logger.info('Session status updated', { sessionId, status });
    } catch (error) {
      logger.error('Failed to update session status', error instanceof Error ? error : undefined, {
        sessionId,
        status,
      });
      throw error;
    }
  }

  subscribeToState(sessionId: string, callback: StateChangeCallback): () => void {
    if (!this.subscriptions.has(sessionId)) {
      this.subscriptions.set(sessionId, new Set());
    }
    this.subscriptions.get(sessionId)!.add(callback);

    return () => {
      const callbacks = this.subscriptions.get(sessionId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) this.subscriptions.delete(sessionId);
      }
    };
  }

  private notifySubscribers(sessionId: string, state: WorkflowState): void {
    const callbacks = this.subscriptions.get(sessionId);
    if (!callbacks) return;
    for (const callback of callbacks) {
      try {
        callback(state);
      } catch (error) {
        logger.error('Error in state change callback', error instanceof Error ? error : undefined, { sessionId });
      }
    }
  }

  async cleanupOldSessions(olderThanDays: number = 30, tenantId: string): Promise<number> {
    try {
      const count = await this.repository.cleanupOldSessions(olderThanDays, tenantId);
      logger.info('Old sessions cleaned up', { count, olderThanDays });
      return count;
    } catch (error) {
      logger.error('Failed to cleanup old sessions', error instanceof Error ? error : undefined, { olderThanDays });
      return 0;
    }
  }
}
