/**
 * Agent Query Service
 *
 * CRITICAL FIX: Stateless service layer for agent queries
 *
 * This service orchestrates:
 * 1. Session management (via WorkflowStateRepository)
 * 2. Query processing (via UnifiedAgentOrchestrator)
 * 3. State persistence
 * 4. Trace ID generation for observability
 *
 * Usage:
 *   const service = new AgentQueryService(supabase);
 *   const result = await service.handleQuery(query, userId, sessionId);
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

import { logger } from "../lib/logger.js"
import { agentQueryLatency } from "../lib/monitoring/metrics.js"
import { WorkflowStateRepository } from "../repositories/WorkflowStateRepository";
import { sanitizeInput } from "../security/InputSanitizer.js"
import {
  ExecutionRequest,
  normalizeExecutionRequest,
} from "../types/execution";

import { TimeoutError } from "./errors.js"
import {
  AgentResponse,
  getUnifiedOrchestrator,
  UnifiedAgentOrchestrator,
} from "./UnifiedAgentOrchestrator";

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

  /** Initial execution request for new sessions */
  execution?: ExecutionRequest;

  /** Tenant context for session isolation */
  tenantId?: string;

  /** Initial execution context */
  initialContext?: Record<string, any> & {
    organizationId?: string;
  };
}


/**
 * Agent Query Service
 *
 * Provides stateless query handling with database-backed state persistence
 */
export class AgentQueryService {
  private stateRepo: WorkflowStateRepository;
  private orchestrator: UnifiedAgentOrchestrator;

  constructor(private supabase: SupabaseClient) {
    this.stateRepo = new WorkflowStateRepository(supabase);
    this.orchestrator = getUnifiedOrchestrator();
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
    const tenantId = options.tenantId || options.initialContext?.organizationId;
    if (!tenantId) {
      throw new Error("Tenant ID is required to handle agent queries");
    }
    const startTime = Date.now();
    // Generate trace ID for observability
    const traceId = uuidv4();

    logger.info("Handling query", {
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
        logger.warn("Input sanitized", {
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
        currentState = await this.stateRepo.getState(currentSessionId, tenantId);

        if (!currentState) {
          logger.warn("Session not found, creating new session", {
            traceId,
            requestedSessionId: currentSessionId,
          });
          currentSessionId = undefined;
        }
      }

      const executionRequest: ExecutionRequest = options.execution || {
        intent: "FullValueAnalysis",
        environment: "production",
      };
      const normalizedExecution = normalizeExecutionRequest(
        "agent-query",
        executionRequest
      );

      if (!currentSessionId) {
        // Create new session
        const initialState = this.orchestrator.createInitialState(
          options.initialStage || "discovery",
          normalizedExecution
        );

        currentSessionId = await this.stateRepo.createSession(
          userId,
          initialState,
          tenantId
        );
        currentState = initialState;

        logger.info("New session created", {
          traceId,
          sessionId: currentSessionId,
          initialStage: initialState.currentStage,
        });
      }

      // 3. Process query (stateless)
      const envelope = {
        intent: "agent-query",
        actor: { id: userId },
        organizationId: tenantId,
        entryPoint: "agent-query-service",
        reason: "interactive-query",
        timestamps: { requestedAt: new Date().toISOString() },
      } as const;
      const result = await this.orchestrator.processQuery(
        envelope,
        sanitizedQuery,
        currentState!,
        userId,
        currentSessionId,
        traceId
      );

      // 4. Save updated state
      await this.stateRepo.saveState(currentSessionId, result.nextState, tenantId);

      // 5. Update session status if workflow is complete
      if (this.orchestrator.isWorkflowComplete(result.nextState)) {
        await this.stateRepo.updateSessionStatus(
          currentSessionId,
          result.nextState.status === "error" ? "error" : "completed",
          tenantId
        );
      }

      // 6. Calculate progress
      const progress = this.orchestrator.getProgress(result.nextState);

      const durationSeconds = (Date.now() - startTime) / 1000;
      agentQueryLatency
        .labels({ status: "success", model: "standard" })
        .observe(durationSeconds);

      logger.info("Query handled successfully", {
        traceId,
        sessionId: currentSessionId,
        progress,
        nextStage: result.nextState.currentStage,
        durationSeconds,
      });

      return {
        sessionId: currentSessionId,
        response: result.response,
        traceId,
        progress,
      };
    } catch (error) {
      const durationSeconds = (Date.now() - startTime) / 1000;
      agentQueryLatency
        .labels({ status: "error", model: "standard" })
        .observe(durationSeconds);

      logger.error(
        "Error handling query",
        error instanceof Error ? error : undefined,
        {
          traceId,
          userId,
          sessionId,
          durationSeconds,
        }
      );

      // Increment error count if session exists
      if (sessionId) {
        try {
          await this.stateRepo.incrementErrorCount(sessionId, tenantId);
        } catch (err) {
          logger.error(
            "Failed to increment error count",
            err instanceof Error ? err : undefined,
            {
              traceId,
              sessionId,
            }
          );
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
  async getSession(sessionId: string, tenantId: string) {
    return await this.stateRepo.getSession(sessionId, tenantId);
  }

  /**
   * Get active sessions for a user
   *
   * @param userId User identifier
   * @param limit Maximum number of sessions
   * @returns Array of session data
   */
  async getActiveSessions(userId: string, tenantId: string, limit: number = 10) {
    return await this.stateRepo.getActiveSessions(userId, tenantId, limit);
  }

  /**
   * Abandon a session
   *
   * @param sessionId Session identifier
   */
  async abandonSession(sessionId: string, tenantId: string): Promise<void> {
    await this.stateRepo.updateSessionStatus(sessionId, "abandoned", tenantId);
    logger.info("Session abandoned", { sessionId });
  }

  /**
   * Cleanup old sessions
   *
   * @param olderThanDays Delete sessions older than this many days
   * @returns Number of sessions deleted
   */
  async cleanupOldSessions(olderThanDays: number = 30, tenantId: string): Promise<number> {
    return await this.stateRepo.cleanupOldSessions(olderThanDays, tenantId);
  }

  /**
   * Query an agent with timeout and abort logic
   *
   * @param prompt User prompt
   * @param options Query options
   * @returns Agent response
   */
  async queryAgent(prompt: string, options: any = {}): Promise<any> {
    const controller = new AbortController();
    const { signal } = controller;
    const timeout = 30000;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, tenantId: options.tenantId }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError("The request timed out after 30 seconds.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
