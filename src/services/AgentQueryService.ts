/**
 * Agent Query Service
 * 
 * CRITICAL FIX: Stateless service layer for agent queries
 * 
 * This service orchestrates:
 * 1. Session management (via WorkflowStateRepository)
 * 2. Query processing (via StatelessAgentOrchestrator)
 * 3. State persistence
 * 4. Trace ID generation for observability
 * 
 * Usage:
 *   const service = new AgentQueryService(supabase);
 *   const result = await service.handleQuery(query, userId, sessionId);
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger';
import { WorkflowStateRepository } from '../repositories/WorkflowStateRepository';
import { StatelessAgentOrchestrator, AgentResponse } from './StatelessAgentOrchestrator';
import { sanitizeInput } from '../security/InputSanitizer';

export interface QueryResult {
  sessionId: string;
  response: AgentResponse | null;
  traceId: string;
  progress?: number;
}

export interface QueryOptions {
  /** Skip input sanitization (use with caution) */
  skipSanitization?: boolean;
  
  /** Initial workflow stage for new sessions */
  initialStage?: string;
  
  /** Initial context for new sessions */
  initialContext?: Record<string, any>;
}

/**
 * Agent Query Service
 * 
 * Provides stateless query handling with database-backed state persistence
 */
export class AgentQueryService {
  private stateRepo: WorkflowStateRepository;
  private orchestrator: StatelessAgentOrchestrator;

  constructor(private supabase: SupabaseClient) {
    this.stateRepo = new WorkflowStateRepository(supabase);
    this.orchestrator = new StatelessAgentOrchestrator();
  }

  /**
   * Handle a user query
   * 
   * @param query User query
   * @param userId User identifier
   * @param sessionId Optional session ID (creates new if not provided)
   * @param options Query options
   * @returns Query result with response and session info
   */
  async handleQuery(
    query: string,
    userId: string,
    sessionId?: string,
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    // Generate trace ID for observability
    const traceId = uuidv4();

    logger.info('Handling query', {
      traceId,
      userId,
      sessionId,
      queryLength: query.length,
    });

    try {
      // 1. Sanitize input (unless explicitly skipped)
      const sanitizedQuery = options.skipSanitization 
        ? query 
        : sanitizeInput(query);

      if (sanitizedQuery !== query) {
        logger.warn('Input sanitized', {
          traceId,
          originalLength: query.length,
          sanitizedLength: sanitizedQuery.length,
        });
      }

      // 2. Get or create session
      let currentSessionId = sessionId;
      let currentState;

      if (currentSessionId) {
        // Existing session
        currentState = await this.stateRepo.getState(currentSessionId);
        
        if (!currentState) {
          logger.warn('Session not found, creating new session', {
            traceId,
            requestedSessionId: currentSessionId,
          });
          currentSessionId = undefined;
        }
      }

      if (!currentSessionId) {
        // Create new session
        const initialState = this.orchestrator.createInitialState(
          options.initialStage || 'discovery',
          options.initialContext || {}
        );

        currentSessionId = await this.stateRepo.createSession(userId, initialState);
        currentState = initialState;

        logger.info('New session created', {
          traceId,
          sessionId: currentSessionId,
          initialStage: initialState.currentStage,
        });
      }

      // 3. Process query (stateless)
      const result = await this.orchestrator.processQuery(
        sanitizedQuery,
        currentState!,
        userId,
        currentSessionId,
        traceId
      );

      // 4. Save updated state
      await this.stateRepo.saveState(currentSessionId, result.nextState);

      // 5. Update session status if workflow is complete
      if (this.orchestrator.isWorkflowComplete(result.nextState)) {
        await this.stateRepo.updateSessionStatus(
          currentSessionId,
          result.nextState.status === 'error' ? 'error' : 'completed'
        );
      }

      // 6. Calculate progress
      const progress = this.orchestrator.getProgress(result.nextState);

      logger.info('Query handled successfully', {
        traceId,
        sessionId: currentSessionId,
        progress,
        nextStage: result.nextState.currentStage,
      });

      return {
        sessionId: currentSessionId,
        response: result.response,
        traceId,
        progress,
      };
    } catch (error) {
      logger.error('Error handling query', error instanceof Error ? error : undefined, {
        traceId,
        userId,
        sessionId,
      });

      // Increment error count if session exists
      if (sessionId) {
        try {
          await this.stateRepo.incrementErrorCount(sessionId);
        } catch (err) {
          logger.error('Failed to increment error count', err instanceof Error ? err : undefined, {
            traceId,
            sessionId,
          });
        }
      }

      throw error;
    }
  }

  /**
   * Get session information
   * 
   * @param sessionId Session identifier
   * @returns Session data or null if not found
   */
  async getSession(sessionId: string) {
    return await this.stateRepo.getSession(sessionId);
  }

  /**
   * Get active sessions for a user
   * 
   * @param userId User identifier
   * @param limit Maximum number of sessions
   * @returns Array of session data
   */
  async getActiveSessions(userId: string, limit: number = 10) {
    return await this.stateRepo.getActiveSessions(userId, limit);
  }

  /**
   * Abandon a session
   * 
   * @param sessionId Session identifier
   */
  async abandonSession(sessionId: string): Promise<void> {
    await this.stateRepo.updateSessionStatus(sessionId, 'abandoned');
    logger.info('Session abandoned', { sessionId });
  }

  /**
   * Cleanup old sessions
   * 
   * @param olderThanDays Delete sessions older than this many days
   * @returns Number of sessions deleted
   */
  async cleanupOldSessions(olderThanDays: number = 30): Promise<number> {
    return await this.stateRepo.cleanupOldSessions(olderThanDays);
  }
}
