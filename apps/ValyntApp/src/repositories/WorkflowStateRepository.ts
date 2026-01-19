/**
 * Workflow State Repository
 *
 * CRITICAL FIX: Provides database-backed state persistence
 * Replaces singleton in-memory state to enable concurrent request isolation
 *
 * Pattern: Repository pattern for clean separation of concerns
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";
import { WorkflowStatus } from "../types";

/**
 * Workflow state stored in database
 */
export interface WorkflowState {
  currentStage: string;
  status: WorkflowStatus;
  completedStages: string[];
  context: Record<string, any>;
  metadata?: {
    startedAt?: string;
    lastUpdatedAt?: string;
    errorCount?: number;
    retryCount?: number;
  };
}

/**
 * Session data from database
 */
export interface SessionData {
  id: string;
  tenant_id?: string;
  user_id: string;
  workflow_state: WorkflowState;
  status: "active" | "completed" | "error" | "abandoned";
  created_at: string;
  updated_at: string;
}

/**
 * Repository for managing workflow state persistence
 */
export class WorkflowStateRepository {
  constructor(private supabase: SupabaseClient) {}

  private requireTenantId(tenantId: string): string {
    if (!tenantId) {
      throw new Error("Tenant ID is required for workflow state access");
    }
    return tenantId;
  }

  /**
   * Get workflow state for a session
   *
   * @param sessionId Session identifier
   * @returns Workflow state or null if not found
   */
  async getState(sessionId: string, tenantId: string): Promise<WorkflowState | null> {
    try {
      const resolvedTenantId = this.requireTenantId(tenantId);
      const { data, error } = await this.supabase
        .from("agent_sessions")
        .select("workflow_state")
        .eq("id", sessionId)
        .eq("tenant_id", resolvedTenantId)
        .single();

      if (error) {
        logger.error("Failed to get workflow state", { error, sessionId });
        return null;
      }

      if (!data || !data.workflow_state) {
        logger.warn("No workflow state found", { sessionId });
        return null;
      }

      return data.workflow_state as WorkflowState;
    } catch (error) {
      logger.error("Error getting workflow state", {
        error: error instanceof Error ? error : undefined,
        sessionId,
      });
      return null;
    }
  }

  /**
   * Save workflow state for a session
   *
   * @param sessionId Session identifier
   * @param state Workflow state to save
   */
  async saveState(sessionId: string, state: WorkflowState, tenantId: string): Promise<void> {
    try {
      const resolvedTenantId = this.requireTenantId(tenantId);
      // Add metadata
      const stateWithMetadata: WorkflowState = {
        ...state,
        metadata: {
          ...state.metadata,
          lastUpdatedAt: new Date().toISOString(),
        },
      };

      const { error } = await this.supabase
        .from("agent_sessions")
        .update({
          workflow_state: stateWithMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("tenant_id", resolvedTenantId);

      if (error) {
        logger.error("Failed to save workflow state", { error, sessionId });
        throw error;
      }

      logger.debug("Workflow state saved", {
        sessionId,
        stage: state.currentStage,
        status: state.status,
      });
    } catch (error) {
      logger.error("Error saving workflow state", {
        error: error instanceof Error ? error : undefined,
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Create a new session with initial workflow state
   *
   * @param userId User identifier
   * @param initialState Initial workflow state
   * @returns Session ID
   */
  async createSession(
    userId: string,
    initialState: WorkflowState,
    tenantId: string
  ): Promise<string> {
    try {
      const resolvedTenantId = this.requireTenantId(tenantId);
      // Add metadata
      const stateWithMetadata: WorkflowState = {
        ...initialState,
        metadata: {
          startedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          errorCount: 0,
          retryCount: 0,
        },
      };

      const { data, error } = await this.supabase
        .from("agent_sessions")
        .insert({
          user_id: userId,
          tenant_id: resolvedTenantId,
          workflow_state: stateWithMetadata,
          status: "active",
        })
        .select("id")
        .single();

      if (error || !data) {
        logger.error("Failed to create session", { error, userId });
        throw error || new Error("No session ID returned");
      }

      logger.info("Session created", {
        sessionId: data.id,
        userId,
        initialStage: initialState.currentStage,
      });

      return data.id;
    } catch (error) {
      logger.error("Error creating session", {
        error: error instanceof Error ? error : undefined,
        userId,
      });
      throw error;
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
      const resolvedTenantId = this.requireTenantId(tenantId);
      const { data, error } = await this.supabase
        .from("agent_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("tenant_id", resolvedTenantId)
        .single();

      if (error) {
        logger.error("Failed to get session", { error, sessionId });
        return null;
      }

      return data as SessionData;
    } catch (error) {
      logger.error("Error getting session", {
        error: error instanceof Error ? error : undefined,
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
    status: "active" | "completed" | "error" | "abandoned",
    tenantId: string
  ): Promise<void> {
    try {
      const resolvedTenantId = this.requireTenantId(tenantId);
      const { error } = await this.supabase
        .from("agent_sessions")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("tenant_id", resolvedTenantId);

      if (error) {
        logger.error("Failed to update session status", { error, sessionId, status });
        throw error;
      }

      logger.debug("Session status updated", { sessionId, status });
    } catch (error) {
      logger.error("Error updating session status", {
        error: error instanceof Error ? error : undefined,
        sessionId,
        status,
      });
      throw error;
    }
  }

  /**
   * Increment error count for a session
   *
   * @param sessionId Session identifier
   */
  async incrementErrorCount(sessionId: string, tenantId: string): Promise<void> {
    try {
      const state = await this.getState(sessionId, tenantId);
      if (!state) {
        throw new Error("Session not found");
      }

      const updatedState: WorkflowState = {
        ...state,
        metadata: {
          ...state.metadata,
          errorCount: (state.metadata?.errorCount || 0) + 1,
          lastUpdatedAt: new Date().toISOString(),
        },
      };

      await this.saveState(sessionId, updatedState, tenantId);
    } catch (error) {
      logger.error("Error incrementing error count", {
        error: error instanceof Error ? error : undefined,
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Get active sessions for a user
   *
   * @param userId User identifier
   * @param limit Maximum number of sessions to return
   * @returns Array of session data
   */
  async getActiveSessions(
    userId: string,
    tenantId: string,
    limit: number = 10
  ): Promise<SessionData[]> {
    try {
      const resolvedTenantId = this.requireTenantId(tenantId);
      const { data, error } = await this.supabase
        .from("agent_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("tenant_id", resolvedTenantId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error) {
        logger.error("Failed to get active sessions", { error, userId });
        return [];
      }

      return (data || []) as SessionData[];
    } catch (error) {
      logger.error("Error getting active sessions", {
        error: error instanceof Error ? error : undefined,
        userId,
      });
      return [];
    }
  }

  /**
   * Clean up old sessions
   *
   * @param olderThanDays Delete sessions older than this many days
   * @returns Number of sessions deleted
   */
  async cleanupOldSessions(olderThanDays: number = 30, tenantId: string): Promise<number> {
    try {
      const resolvedTenantId = this.requireTenantId(tenantId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { data, error } = await this.supabase
        .from("agent_sessions")
        .delete()
        .lt("updated_at", cutoffDate.toISOString())
        .eq("tenant_id", resolvedTenantId)
        .neq("status", "active")
        .select("id");

      if (error) {
        logger.error("Failed to cleanup old sessions", { error, olderThanDays });
        return 0;
      }

      const count = data?.length || 0;
      logger.info("Old sessions cleaned up", { count, olderThanDays });
      return count;
    } catch (error) {
      logger.error("Error cleaning up old sessions", {
        error: error instanceof Error ? error : undefined,
        olderThanDays,
      });
      return 0;
    }
  }

  /**
   * Atomic state update with optimistic locking
   *
   * Prevents race conditions by checking updated_at timestamp
   *
   * @param sessionId Session identifier
   * @param expectedUpdatedAt Expected last update timestamp
   * @param newState New workflow state
   * @param tenantId Tenant identifier
   * @returns True if update succeeded, false if conflict detected
   */
  async atomicStateUpdate(
    sessionId: string,
    expectedUpdatedAt: string,
    newState: WorkflowState,
    tenantId: string
  ): Promise<boolean> {
    try {
      const resolvedTenantId = this.requireTenantId(tenantId);
      const stateWithMetadata: WorkflowState = {
        ...newState,
        metadata: {
          ...newState.metadata,
          lastUpdatedAt: new Date().toISOString(),
        },
      };

      const { data, error } = await this.supabase
        .from("agent_sessions")
        .update({
          workflow_state: stateWithMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("tenant_id", resolvedTenantId)
        .eq("updated_at", expectedUpdatedAt)
        .select("id");

      if (error) {
        logger.error("Failed atomic state update", { error, sessionId });
        return false;
      }

      if (!data || data.length === 0) {
        logger.warn("Atomic state update conflict detected", {
          sessionId,
          expectedUpdatedAt,
        });
        return false;
      }

      logger.debug("Atomic state update succeeded", { sessionId });
      return true;
    } catch (error) {
      logger.error("Error in atomic state update", {
        error: error instanceof Error ? error : undefined,
        sessionId,
      });
      return false;
    }
  }
}
