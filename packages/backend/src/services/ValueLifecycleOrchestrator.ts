/**
 * ValueLifecycleOrchestrator — thin facade
 *
 * Provides the simplified interface used by WorkflowLifecycleIntegration
 * (string stage, unknown input, { tenantId, userId? }) and delegates to the
 * full implementation in post-v1/ValueLifecycleOrchestrator.ts.
 *
 * Dependencies are lazy-imported to avoid circular module loading and cached
 * as a module-level singleton to avoid per-call allocation overhead.
 */

import { logger } from "../lib/logger.js";

export interface LifecycleStageResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Cached singleton — initialised once on first call.
let cachedOrchestrator: {
  executeLifecycleStage(
    stage: import("../types/workflow.js").WorkflowStageType,
    input: Record<string, unknown>,
    context: { userId: string; tenantId: string; organizationId: string }
  ): Promise<{ success: boolean; data: Record<string, unknown> | null; error?: string }>;
} | null = null;

async function getOrchestrator() {
  if (cachedOrchestrator) return cachedOrchestrator;

  const [
    { ValueLifecycleOrchestrator: RealOrchestrator },
    { LLMGateway },
    { MemorySystem },
    { SupabaseMemoryBackend },
    { AuditLogger },
    { createServerSupabaseClient },
  ] = await Promise.all([
    import("./post-v1/ValueLifecycleOrchestrator.js"),
    import("../lib/agent-fabric/LLMGateway.js"),
    import("../lib/agent-fabric/MemorySystem.js"),
    import("../lib/agent-fabric/SupabaseMemoryBackend.js"),
    import("../lib/agent-fabric/AuditLogger.js"),
    import("../lib/supabase.js"),
  ]);

  const supabaseClient = createServerSupabaseClient();
  const llmGateway = new LLMGateway({
    provider: "together",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  });
  const memorySystem = new MemorySystem(
    { max_memories: 1000, enable_persistence: true },
    new SupabaseMemoryBackend()
  );
  const auditLogger = new AuditLogger();

  cachedOrchestrator = new RealOrchestrator(
    // Both are SupabaseClient instances; the generic parameter mismatch
    // between the two createClient call sites is safe to cast through unknown.
    supabaseClient as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient>,
    llmGateway,
    memorySystem,
    auditLogger
  );

  return cachedOrchestrator;
}

export class ValueLifecycleOrchestrator {
  /**
   * Execute a single lifecycle stage.
   * Delegates to the real orchestrator in post-v1/ using a cached singleton.
   */
  async executeLifecycleStage(
    agentType: string,
    input: unknown,
    context: { tenantId: string; userId?: string }
  ): Promise<LifecycleStageResult> {
    logger.info("ValueLifecycleOrchestrator: executing lifecycle stage", {
      agentType,
      tenantId: context.tenantId,
    });

    try {
      const orchestrator = await getOrchestrator();

      const result = await orchestrator.executeLifecycleStage(
        agentType as import("../types/workflow.js").WorkflowStageType,
        input as Record<string, unknown>,
        {
          userId: context.userId ?? "system",
          tenantId: context.tenantId,
          organizationId: context.tenantId,
        }
      );

      return {
        success: result.success,
        data: result.data ?? undefined,
        error: result.error,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("ValueLifecycleOrchestrator: stage execution failed", {
        agentType,
        tenantId: context.tenantId,
        error: message,
      });
      return { success: false, error: message };
    }
  }
}
