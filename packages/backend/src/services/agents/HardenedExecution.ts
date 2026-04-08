import { trace } from "@opentelemetry/api";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import {
  CONFIDENCE_THRESHOLDS,
  GovernanceVetoError,
  HardenedAgentRunner,
} from "../../lib/agent-fabric/hardening/index.js";
import type { LifecycleContext } from "../../types/agent.js";
import type { AgentType } from "../agent-types.js";

export type HardeningRiskTier = keyof typeof CONFIDENCE_THRESHOLDS;

export interface GovernanceVetoStatus {
  httpStatus: 422 | 423;
  apiStatus: "blocked" | "pending_human_review";
  errorCode: "AGENT_GOVERNANCE_VETOED" | "AGENT_GOVERNANCE_PENDING_HUMAN";
}

export interface HardenedExecutionResult<TOutput = unknown> {
  output: TOutput;
  confidence: {
    overall: number;
    label: string;
  };
  governance: {
    verdict: string;
  };
  tokenUsage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const GENERIC_HARDENED_OUTPUT_SCHEMA = z.unknown();

export function resolveHardeningRiskTier(agent: AgentType): HardeningRiskTier {
  if (agent === "financial-modeling") return "financial";
  if (agent === "narrative") return "narrative";
  if (agent === "compliance-auditor") return "compliance";
  if (
    agent === "communicator" ||
    agent === "company-intelligence" ||
    agent === "value-eval"
  ) {
    return "commitment";
  }
  return "discovery";
}

export function requiresHardenedExecution(agent: AgentType): boolean {
  const riskTier = resolveHardeningRiskTier(agent);
  return ["financial", "commitment", "narrative", "compliance"].includes(
    riskTier
  );
}

export function mapGovernanceVetoStatus(
  error: GovernanceVetoError
): GovernanceVetoStatus {
  if (error.verdict === "pending_human") {
    return {
      httpStatus: 423,
      apiStatus: "pending_human_review",
      errorCode: "AGENT_GOVERNANCE_PENDING_HUMAN",
    };
  }
  return {
    httpStatus: 422,
    apiStatus: "blocked",
    errorCode: "AGENT_GOVERNANCE_VETOED",
  };
}

export async function executeWithHardenedRunner<TContext extends LifecycleContext, TOutput>(params: {
  agentId: AgentType;
  lifecycleContext: TContext;
  organizationId: string;
  userId: string;
  sessionId: string;
  traceId: string;
  prompt: string;
  outputSchema?: z.ZodTypeAny;
  execute: (ctx: TContext) => Promise<TOutput>;
}): Promise<HardenedExecutionResult<TOutput>> {
  const riskTier = resolveHardeningRiskTier(params.agentId);
  const runner = new HardenedAgentRunner({
    agentName: String(params.agentId),
    agentVersion: "1.0.0",
    lifecycleStage: String(params.lifecycleContext.lifecycle_stage),
    organizationId: params.organizationId,
    allowedTools: new Set(),
    riskTier,
    integrityVetoService: null,
    hitlPort: null,
  });

  const hardened = await runner.run(
    {
      request_id: uuidv4(),
      trace_id: params.traceId,
      session_id: params.sessionId,
      user_id: params.userId,
      organization_id: params.organizationId,
      received_at: new Date().toISOString(),
    },
    params.lifecycleContext,
    params.execute,
    {
      prompt: params.prompt,
      outputSchema: params.outputSchema ?? GENERIC_HARDENED_OUTPUT_SCHEMA,
      riskTier,
      requiresIntegrityVeto: true,
      requiresHumanApproval: false,
    }
  );

  const span = trace.getActiveSpan();
  span?.setAttribute("agent.governance.verdict", hardened.governance.verdict);
  span?.setAttribute("agent.confidence.overall", hardened.confidence.overall);
  span?.setAttribute("agent.confidence.label", hardened.confidence.label);

  return {
    output: hardened.output as TOutput,
    confidence: {
      overall: hardened.confidence.overall,
      label: hardened.confidence.label,
    },
    governance: {
      verdict: hardened.governance.verdict,
    },
    tokenUsage: {
      prompt_tokens: hardened.token_usage.input_tokens,
      completion_tokens: hardened.token_usage.output_tokens,
      total_tokens: hardened.token_usage.total_tokens,
    },
  };
}
