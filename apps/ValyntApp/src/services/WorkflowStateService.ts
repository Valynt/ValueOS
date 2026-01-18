/**
 * Workflow State Service
<<<<<<< HEAD
 * 
 * Client-side bridge to WorkflowStateRepository for chat workflows.
 * Provides session management and state persistence for ChatCanvas.
 * 
=======
 *
 * Client-side bridge to WorkflowStateRepository for chat workflows.
 * Provides session management and state persistence for ChatCanvas.
 *
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
 * Architecture:
 * - Separates UI concerns from persistence logic
 * - Handles session lifecycle (create, load, save, cleanup)
 * - Provides real-time state updates via subscriptions
 */

<<<<<<< HEAD
import { SupabaseClient } from '@supabase/supabase-js';
import { SessionData, WorkflowState, WorkflowStateRepository } from '../repositories/WorkflowStateRepository';
import { logger } from '../lib/logger';
import type { LifecycleStage } from '../types/vos';
=======
import { SupabaseClient } from "@supabase/supabase-js";
import {
  SessionData,
  WorkflowState,
  WorkflowStateRepository,
} from "../repositories/WorkflowStateRepository";
import { logger } from "../lib/logger";
import type { LifecycleStage } from "../types/vos";
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98

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
<<<<<<< HEAD
 * 
=======
 *
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
 * Provides high-level API for chat workflow state management
 */
export class WorkflowStateService {
  private repository: WorkflowStateRepository;
  private subscriptions: Map<string, Set<StateChangeCallback>> = new Map();

  constructor(supabaseClient: SupabaseClient) {
    this.repository = new WorkflowStateRepository(supabaseClient);
  }

  /**
   * Load existing session or create new one
<<<<<<< HEAD
   * 
=======
   *
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
   * @param options Session initialization options
   * @returns Session ID and initial workflow state
   */
  async loadOrCreateSession(
    options: SessionInitOptions
  ): Promise<{ sessionId: string; state: WorkflowState }> {
<<<<<<< HEAD
    const { caseId, userId, tenantId, initialStage = 'opportunity', context = {} } = options;
=======
    const { caseId, userId, tenantId, initialStage = "opportunity", context = {} } = options;
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98

    try {
      // Try to find existing active session for this case
      const existingSessions = await this.repository.getActiveSessions(userId, tenantId, 10);
      const existingSession = existingSessions.find(
<<<<<<< HEAD
        session => session.workflow_state?.context?.caseId === caseId
      );

      if (existingSession) {
        logger.info('Resuming existing session', {
=======
        (session) => session.workflow_state?.context?.caseId === caseId
      );

      if (existingSession) {
        logger.info("Resuming existing session", {
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
          sessionId: existingSession.id,
          caseId,
        });

        return {
          sessionId: existingSession.id,
          state: existingSession.workflow_state,
        };
      }

      // No existing session, create new one
<<<<<<< HEAD
      logger.info('Creating new session', { caseId, userId, initialStage });

      const initialState: WorkflowState = {
        currentStage: initialStage,
        status: 'in_progress',
=======
      logger.info("Creating new session", { caseId, userId, initialStage });

      const initialState: WorkflowState = {
        currentStage: initialStage,
        status: "in_progress",
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
        completedStages: [],
        context: {
          ...context,
          caseId,
<<<<<<< HEAD
          company: context.company || '',
=======
          company: context.company || "",
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
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
<<<<<<< HEAD
      logger.error('Failed to load/create session', {
=======
      logger.error("Failed to load/create session", {
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
        error: error instanceof Error ? error : undefined,
        caseId,
        userId,
      });
<<<<<<< HEAD
      throw new Error('Failed to initialize workflow session');
=======
      throw new Error("Failed to initialize workflow session");
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
    }
  }

  /**
   * Save workflow state
<<<<<<< HEAD
   * 
   * @param sessionId Session identifier
   * @param state Updated workflow state
   */
  async saveWorkflowState(sessionId: string, state: WorkflowState, tenantId: string): Promise<void> {
    try {
      await this.repository.saveState(sessionId, state, tenantId);
      
      logger.debug('Workflow state saved', {
=======
   *
   * @param sessionId Session identifier
   * @param state Updated workflow state
   */
  async saveWorkflowState(
    sessionId: string,
    state: WorkflowState,
    tenantId: string
  ): Promise<void> {
    try {
      await this.repository.saveState(sessionId, state, tenantId);

      logger.debug("Workflow state saved", {
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
        sessionId,
        stage: state.currentStage,
        status: state.status,
      });

      // Notify subscribers
      this.notifySubscribers(sessionId, state);
    } catch (error) {
<<<<<<< HEAD
      logger.error('Failed to save workflow state', error instanceof Error ? error : undefined, {
=======
      logger.error("Failed to save workflow state", error instanceof Error ? error : undefined, {
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Get workflow state
<<<<<<< HEAD
   * 
=======
   *
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
   * @param sessionId Session identifier
   * @returns Workflow state or null if not found
   */
  async getWorkflowState(sessionId: string, tenantId: string): Promise<WorkflowState | null> {
    try {
      return await this.repository.getState(sessionId, tenantId);
    } catch (error) {
<<<<<<< HEAD
      logger.error('Failed to get workflow state', error instanceof Error ? error : undefined, {
=======
      logger.error("Failed to get workflow state", error instanceof Error ? error : undefined, {
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
        sessionId,
      });
      return null;
    }
  }

  /**
   * Get full session data
<<<<<<< HEAD
   * 
=======
   *
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
   * @param sessionId Session identifier
   * @returns Session data or null if not found
   */
  async getSession(sessionId: string, tenantId: string): Promise<SessionData | null> {
    try {
      return await this.repository.getSession(sessionId, tenantId);
    } catch (error) {
<<<<<<< HEAD
      logger.error('Failed to get session', {
=======
      logger.error("Failed to get session", {
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
        error: error instanceof Error ? error : undefined,
        sessionId,
      });
      return null;
    }
  }

  /**
   * Update session status
<<<<<<< HEAD
   * 
=======
   *
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
   * @param sessionId Session identifier
   * @param status New status
   */
  async updateSessionStatus(
    sessionId: string,
<<<<<<< HEAD
    status: 'active' | 'completed' | 'error' | 'abandoned',
=======
    status: "active" | "completed" | "error" | "abandoned",
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
    tenantId: string
  ): Promise<void> {
    try {
      await this.repository.updateSessionStatus(sessionId, status, tenantId);
<<<<<<< HEAD
      
      logger.info('Session status updated', { sessionId, status });
    } catch (error) {
      logger.error('Failed to update session status', error instanceof Error ? error : undefined, {
=======

      logger.info("Session status updated", { sessionId, status });
    } catch (error) {
      logger.error("Failed to update session status", error instanceof Error ? error : undefined, {
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
        sessionId,
        status,
      });
      throw error;
    }
  }

  /**
   * Subscribe to state changes for a session
<<<<<<< HEAD
   * 
   * Note: This is a client-side subscription model.
   * For real-time DB updates, consider Supabase realtime subscriptions.
   * 
=======
   *
   * Note: This is a client-side subscription model.
   * For real-time DB updates, consider Supabase realtime subscriptions.
   *
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
   * @param sessionId Session identifier
   * @param callback Callback function
   * @returns Unsubscribe function
   */
  subscribeToState(sessionId: string, callback: StateChangeCallback): () => void {
    if (!this.subscriptions.has(sessionId)) {
      this.subscriptions.set(sessionId, new Set());
    }

    this.subscriptions.get(sessionId)!.add(callback);

<<<<<<< HEAD
    logger.debug('State subscription added', { sessionId });
=======
    logger.debug("State subscription added", { sessionId });
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(sessionId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(sessionId);
        }
      }
<<<<<<< HEAD
      logger.debug('State subscription removed', { sessionId });
=======
      logger.debug("State subscription removed", { sessionId });
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
    };
  }

  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(sessionId: string, state: WorkflowState): void {
    const callbacks = this.subscriptions.get(sessionId);
    if (callbacks) {
<<<<<<< HEAD
      callbacks.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          logger.error('Error in state change callback', {
=======
      callbacks.forEach((callback) => {
        try {
          callback(state);
        } catch (error) {
          logger.error("Error in state change callback", {
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
            error: error instanceof Error ? error : undefined,
            sessionId,
          });
        }
      });
    }
  }

  /**
   * Cleanup old sessions
<<<<<<< HEAD
   * 
=======
   *
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
   * @param olderThanDays Delete sessions older than this many days
   * @returns Number of sessions deleted
   */
  async cleanupOldSessions(olderThanDays: number = 30, tenantId: string): Promise<number> {
    try {
      const count = await this.repository.cleanupOldSessions(olderThanDays, tenantId);
<<<<<<< HEAD
      logger.info('Old sessions cleaned up', { count, olderThanDays });
      return count;
    } catch (error) {
      logger.error('Failed to cleanup old sessions', {
=======
      logger.info("Old sessions cleaned up", { count, olderThanDays });
      return count;
    } catch (error) {
      logger.error("Failed to cleanup old sessions", {
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
        error: error instanceof Error ? error : undefined,
        olderThanDays,
      });
      return 0;
    }
  }
}
