/**
 * ContextStore
 *
 * Assembles the structured domain state (DecisionContext) from the database
 * and memory systems for agent consumption. Extracted from UnifiedAgentOrchestrator in Sprint 4.
 *
 * Also owns handleWorkflowFailure — the single write path that marks a
 * workflow_executions row as failed and emits an error log.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger.js";

// ============================================================================
// Types
// ============================================================================

export interface WorkflowFailureUpdate {
  status: "failed";
  error_message: string;
  completed_at: string;
}

// ============================================================================
// ContextStore
// ============================================================================

export class ContextStore {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Marks a workflow execution as failed and logs the error.
   *
   * The Supabase update result is checked; a DB-level error is logged as a
   * secondary failure rather than swallowed silently.
   */
  async handleWorkflowFailure(
    executionId: string,
    organizationId: string,
    errorMessage: string,
  ): Promise<void> {
    const update: WorkflowFailureUpdate = {
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    };

    const { error: dbError } = await this.supabase
      .from("workflow_executions")
      .update(update)
      .eq("id", executionId)
      .eq("organization_id", organizationId);

    if (dbError) {
      // Log but do not re-throw — the caller's error is the primary failure.
      logger.error("Failed to persist workflow failure status", new Error(dbError.message), {
        executionId,
        organizationId,
        dbError: dbError.message,
      });
    }

    logger.error("Workflow failed", undefined, { executionId, errorMessage });
  }
}
