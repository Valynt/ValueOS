import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

import { createAgentFactory } from "../../lib/agent-fabric/AgentFactory.js";
import { CircuitBreaker } from "../../lib/agent-fabric/CircuitBreaker.js";
import { LLMGateway } from "../../lib/agent-fabric/LLMGateway.js";
import { MemorySystem } from "../../lib/agent-fabric/MemorySystem.js";
import { SupabaseMemoryBackend } from "../../lib/agent-fabric/SupabaseMemoryBackend.js";
import { logger } from "../../lib/logger.js";
import { type AuthenticatedRequest } from "../../middleware/auth.js";
import type { LifecycleContext, LifecycleStage } from "../../types/agent.js";
import { getBackHalfLLMGatewayConfig } from "./backHalfFactoryConfig.js";
import { getCaseId, getTenantId, RunAgentBodySchema } from "./backHalf.shared.js";

let factoryInstance: ReturnType<typeof createAgentFactory> | null = null;

function getFactory() {
  if (!factoryInstance) {
    factoryInstance = createAgentFactory({
      llmGateway: new LLMGateway(getBackHalfLLMGatewayConfig()),
      memorySystem: new MemorySystem(
        { max_memories: 1000, enable_persistence: true },
        new SupabaseMemoryBackend()
      ),
      circuitBreaker: new CircuitBreaker(),
    });
  }

  return factoryInstance;
}

export async function runAgent(
  req: Request,
  res: Response,
  agentId: string,
  lifecycleStage: LifecycleStage
): Promise<Response> {
  const tenantId = getTenantId(req);
  const caseId = getCaseId(req);
  const userId = (req as AuthenticatedRequest).user?.id ?? "unknown";

  if (!tenantId) {
    return res.status(401).json({ success: false, error: "Tenant context required" });
  }
  if (!caseId) {
    return res.status(400).json({ success: false, error: "Case ID required" });
  }

  const parsed = RunAgentBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
  }

  const factory = getFactory();
  if (!factory.hasFabricAgent(agentId)) {
    return res.status(404).json({ success: false, error: `Agent "${agentId}" not registered` });
  }

  const jobId = uuidv4();
  const startTime = Date.now();

  try {
    const agent = factory.create(agentId, tenantId);
    const context: LifecycleContext = {
      workspace_id: jobId,
      organization_id: tenantId,
      user_id: userId,
      lifecycle_stage: lifecycleStage,
      user_inputs: {
        value_case_id: caseId,
        ...(parsed.data.parameters ?? {}),
      },
      workspace_data: {},
      previous_stage_outputs: (parsed.data.context as Record<string, unknown> | undefined)
        ?.previous_stage_outputs as Record<string, unknown> | undefined,
      metadata: { job_id: jobId, value_case_id: caseId },
    };

    const output = await agent.execute(context);
    const durationMs = Date.now() - startTime;

    logger.info("Back-half agent run completed", {
      agentId,
      caseId,
      tenantId,
      userId,
      status: output.status,
      duration_ms: durationMs,
    });

    return res.status(200).json({
      success: true,
      data: {
        jobId,
        agentId,
        status: output.status,
        result: output.result,
        confidence: output.confidence,
        duration_ms: durationMs,
      },
    });
  } catch (err) {
    logger.error("Back-half agent run failed", {
      agentId,
      caseId,
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ success: false, error: "Agent execution failed" });
  }
}
