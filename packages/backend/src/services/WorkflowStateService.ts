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

import { SupabaseClient } from '@supabase/supabase-js';
import { SessionData, WorkflowState, WorkflowStateRepository } from '../repositories/WorkflowStateRepository';
import { logger } from '../lib/logger';
import type { LifecycleStage } from '../types/vos';

/**
 * Session initialization options
 */
export interface SessionInitOptions {
  caseId: string;
  userId: string;
  tenantId: string;
  initialStage?: LifecycleStage;
  context?: Record<string, any>;
}

/**
 * Subscription callback for state changes
 */
export type StateChangeCallback = (state: WorkflowState) => void;

/**
 * Workflow State Service
 *
 * Provides high-level API for chat workflow state management
 */
export class WorkflowStateService {
  private repository: WorkflowStateRepository;
  private subscriptions: Map<string, Set<StateChangeCallback>> = new Map();

  constructor(supabaseClient: SupabaseClient) {
    this.repository = new WorkflowStateRepository(supabaseClient);
  }

  /**
   * Load existing session or create new one with database-level filtering
   *
   * @param options Session initialization options
   * @returns Session ID and initial workflow state
   */
  async loadOrCreateSession(
    options: SessionInitOptions
  ): Promise<{ sessionId: string; state: WorkflowState }> {
    const { caseId, userId, tenantId, initialStage = 'opportunity', context = {} } = options;

    try {
      // Query for specific case at database level (more efficient)
      const existingSession = await this.repository.getActiveSessionForCase(
        userId,
        tenantId,
        caseId
      );

      if (existingSession) {
        logger.info('Resuming existing session', {
          sessionId: existingSession.id,
          caseId,
        });

        return {
          sessionId: existingSession.id,
          state: existingSession.workflow_state,
        };
      }

      // No existing session, create new one
      logger.info('Creating new session', { caseId, userId, initialStage });

      const initialState: WorkflowState = {
        currentStage: initialStage,
        status: 'in_progress',
        completedStages: [],
        context: {
          ...context,
          caseId,
          company: context.company || '',
        },
        metadata: {
          startedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          errorCount: 0,
          retryCount: 0,
        },
      };

      const sessionId = await this.repository.createSession(userId, initialState, tenantId);

      return {
        sessionId,
        state: initialState,
      };
    } catch (error) {
      logger.error('Failed to load/create session', error instanceof Error ? error : undefined, {
        caseId,
        userId,
      });
      throw new Error('Failed to initialize workflow session');
    }
  }

  /**
   * Save workflow state
   *
   * @param sessionId Session identifier
   * @param state Updated workflow state
   */
  async saveWorkflowState(sessionId: string, state: WorkflowState, tenantId: string): Promise<void> {
    try {
      await this.repository.saveState(sessionId, state, tenantId);

      logger.debug('Workflow state saved', {
        sessionId,
        stage: state.currentStage,
        status: state.status,
      });

      // Notify subscribers
      this.notifySubscribers(sessionId, state);
    } catch (error) {
      logger.error('Failed to save workflow state', error instanceof Error ? error : undefined, {
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Get workflow state
   *
   * @param sessionId Session identifier
   * @returns Workflow state or null if not found
   */
  async getWorkflowState(sessionId: string, tenantId: string): Promise<WorkflowState | null> {
    try {
      return await this.repository.getState(sessionId, tenantId);
    } catch (error) {
      logger.error('Failed to get workflow state', error instanceof Error ? error : undefined, {
        sessionId,
      });
      return null;
    }
  }

  /**
   * Get full session data
   *
   * @param sessionId Session identifier
   * @returns Session data or null if not found
   */
  async getSession(sessionId: string, tenantId: string): Promise<SessionData | null> {
    try {
      return await this.repository.getSession(sessionId, tenantId);
    } catch (error) {
      logger.error('Failed to get session', error instanceof Error ? error : undefined, {
        sessionId,
      });
      return null;
    }
  }

  /**
   * Update session status
   *
   * @param sessionId Session identifier
   * @param status New status
   */
  async updateSessionStatus(
    sessionId: string,
    status: 'active' | 'completed' | 'error' | 'abandoned',
    tenantId: string
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

  /**
   * Subscribe to state changes for a session
   *
   * Note: This is a client-side subscription model.
   * For real-time DB updates, consider Supabase realtime subscriptions.
   *
   * @param sessionId Session identifier
   * @param callback Callback function
   * @returns Unsubscribe function
   */
  subscribeToState(sessionId: string, callback: StateChangeCallback): () => void {
    if (!this.subscriptions.has(sessionId)) {
      this.subscriptions.set(sessionId, new Set());
    }

    this.subscriptions.get(sessionId)!.add(callback);

    logger.debug('State subscription added', { sessionId });

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(sessionId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(sessionId);
        }
      }
      logger.debug('State subscription removed', { sessionId });
    };
  }

  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(sessionId: string, state: WorkflowState): void {
    const callbacks = this.subscriptions.get(sessionId);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          logger.error('Error in state change callback', error instanceof Error ? error : undefined, {
            sessionId,
          });
        }
      });
    }
  }

  /**
   * Cleanup old sessions
   *
   * @param olderThanDays Delete sessions older than this many days
   * @returns Number of sessions deleted
   */
  async cleanupOldSessions(olderThanDays: number = 30, tenantId: string): Promise<number> {
    try {
      const count = await this.repository.cleanupOldSessions(olderThanDays, tenantId);
      logger.info('Old sessions cleaned up', { count, olderThanDays });
      return count;
    } catch (error) {
      logger.error('Failed to cleanup old sessions', error instanceof Error ? error : undefined, {
        olderThanDays,
      });
      return 0;
    }
  }
}
