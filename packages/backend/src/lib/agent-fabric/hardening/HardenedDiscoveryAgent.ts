/**
 * HardenedDiscoveryAgent — Example Hardened Agent Implementation
 *
 * Demonstrates how to wrap an existing BaseAgent subclass with the full
 * hardening stack. This is the reference pattern for all agents that need
 * enterprise-grade reliability, governance, and auditability.
 *
 * What this adds on top of the base DiscoveryAgent:
 *   - Pre-call prompt injection scan
 *   - Per-call timeout (configurable, default 45 s)
 *   - Retry with exponential backoff (max 3 attempts)
 *   - Circuit breaker (inherited from BaseAgent, surfaced here)
 *   - Zod output schema validation
 *   - Confidence scoring with risk-tier thresholds (discovery tier)
 *   - IntegrityAgent veto on financial hypothesis outputs
 *   - Human-in-the-loop checkpoint when confidence < accept threshold
 *   - Structured execution log (request_id, trace_id, latency, cost)
 *   - OTel span per invocation
 *
 * Usage:
 *   const agent = new HardenedDiscoveryAgent(deps);
 *   const result = await agent.runHardened(envelope, context);
 */

import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { DiscoveryAgent } from "./../../agent-fabric/agents/DiscoveryAgent.js";
import type { AgentConfig, AgentOutput, LifecycleContext } from "../../../types/agent.js";
import { LLMGateway } from "../LLMGateway.js";
import { MemorySystem } from "../MemorySystem.js";
import { CircuitBreaker } from "../CircuitBreaker.js";
import { logger } from "../../logger.js";
import type { RequestEnvelope } from "./AgentHardeningTypes.js";
import { HardenedAgentRunner, GovernanceVetoError } from "./HardenedAgentRunner.js";
import type {
  HITLCheckpointPort,
  IntegrityVetoServicePort,
} from "./AgentGovernanceLayer.js";

// ---------------------------------------------------------------------------
// Output schema — every hardened agent must declare one
// ---------------------------------------------------------------------------

const HypothesisSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(["cost_reduction", "revenue_uplift", "risk_reduction", "efficiency"]),
  estimated_impact: z.object({
    low: z.number().nonnegative(),
    high: z.number().nonnegative(),
    unit: z.string(),
    timeframe_months: z.number().int().positive(),
  }),
  /** 0–1 confidence in this hypothesis. */
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  assumptions: z.array(z.string()),
  /** Required for CFO-defensible audit trail. */
  evidence_links: z.array(
    z.object({
      metric_key: z.string(),
      metric_value: z.number(),
      source: z.string(),
      source_date: z.string().optional(),
    })
  ),
});

export const DiscoveryOutputSchema = z.object({
  hypotheses: z.array(HypothesisSchema).min(1),
  overall_confidence: z.number().min(0).max(1),
  discovery_summary: z.string(),
  /** Hallucination check result from secureInvoke. */
  hallucination_check: z.boolean(),
});

export type DiscoveryOutput = z.infer<typeof DiscoveryOutputSchema>;

// ---------------------------------------------------------------------------
// Allowed tools for DiscoveryAgent
// ---------------------------------------------------------------------------

const DISCOVERY_ALLOWED_TOOLS = new Set([
  "web_search",
  "company_lookup",
  "industry_benchmark",
  "memory_query",
  "memory_store",
  "value_graph_read",
]);

// ---------------------------------------------------------------------------
// HardenedDiscoveryAgent
// ---------------------------------------------------------------------------

export interface HardenedDiscoveryAgentDeps {
  llmGateway: LLMGateway;
  memorySystem: MemorySystem;
  circuitBreaker: CircuitBreaker;
  organizationId: string;
  integrityVetoService?: IntegrityVetoServicePort | null;
  hitlPort?: HITLCheckpointPort | null;
}

export class HardenedDiscoveryAgent {
  private readonly inner: DiscoveryAgent;
  private readonly runner: HardenedAgentRunner;

  constructor(deps: HardenedDiscoveryAgentDeps) {
    const config: AgentConfig = {
      id: "discovery-agent",
      name: "DiscoveryAgent",
      type: "discovery" as AgentConfig["type"],
      lifecycle_stage: "DISCOVERY",
      capabilities: ["hypothesis_generation", "opportunity_identification"],
      model: {
        provider: "openai",
        model_name: "gpt-4o",
        temperature: 0.3,
        max_tokens: 4096,
      },
      prompts: {
        system_prompt: "",
        user_prompt_template: "",
      },
      parameters: {
        timeout_seconds: 45,
        max_retries: 3,
        retry_delay_ms: 1_000,
        enable_caching: false,
        enable_telemetry: true,
      },
      constraints: {
        max_input_tokens: 8_000,
        max_output_tokens: 4_096,
      },
    };

    this.inner = new DiscoveryAgent(
      config,
      deps.organizationId,
      deps.memorySystem,
      deps.llmGateway,
      deps.circuitBreaker
    );

    this.runner = new HardenedAgentRunner({
      agentName: "DiscoveryAgent",
      agentVersion: "1.0.0",
      lifecycleStage: "DISCOVERY",
      organizationId: deps.organizationId,
      allowedTools: DISCOVERY_ALLOWED_TOOLS,
      riskTier: "discovery",
      retry: { maxRetries: 3, baseDelayMs: 1_000 },
      defaultTimeoutMs: 45_000,
      integrityVetoService: deps.integrityVetoService ?? null,
      hitlPort: deps.hitlPort ?? null,
    });
  }

  /**
   * Execute the DiscoveryAgent through the full hardening stack.
   *
   * Returns a typed DiscoveryOutput on success.
   * Throws GovernanceVetoError when governance blocks the output.
   * Throws Error on timeout, circuit open, or exhausted retries.
   */
  async runHardened(
    envelope: RequestEnvelope,
    context: LifecycleContext
  ): Promise<DiscoveryOutput> {
    const prompt = this.buildPrompt(context);

    try {
      const result = await this.runner.run<DiscoveryOutput>(
        envelope,
        context,
        (ctx) => this.inner.execute(ctx),
        {
          prompt,
          outputSchema: DiscoveryOutputSchema,
          riskTier: "discovery",
          requiresIntegrityVeto: true,
          requiresHumanApproval: false,
          idempotencyKey: `discovery:${context.workspace_id}:${envelope.request_id}`,
          toolsRequested: ["web_search", "company_lookup", "memory_query"],
          timeoutMs: 45_000,
          maxRetries: 3,
        }
      );

      logger.info("HardenedDiscoveryAgent.success", {
        request_id: envelope.request_id,
        hypothesis_count: result.output.hypotheses.length,
        overall_confidence: result.output.overall_confidence,
        governance_verdict: result.governance.verdict,
        latency_ms: result.token_usage.estimated_cost_usd,
        cost_usd: result.token_usage.estimated_cost_usd,
      });

      return result.output;
    } catch (err) {
      if (err instanceof GovernanceVetoError) {
        logger.warn("HardenedDiscoveryAgent.vetoed", {
          request_id: envelope.request_id,
          verdict: err.verdict,
          reason: err.reason,
          checkpoint_id: err.checkpointId,
        });
        throw err;
      }

      logger.error("HardenedDiscoveryAgent.failed", {
        request_id: envelope.request_id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private buildPrompt(context: LifecycleContext): string {
    // In production this uses the Handlebars template from promptRegistry.
    // Shown inline here for clarity.
    return [
      `Discover value hypotheses for workspace ${context.workspace_id}.`,
      `Organization: ${context.organization_id}.`,
      `Lifecycle stage: ${context.lifecycle_stage}.`,
      `Produce structured hypotheses with evidence links for all numeric claims.`,
    ].join(" ");
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

/**
 * Create a HardenedDiscoveryAgent with a generated request envelope.
 * Convenience wrapper for API route handlers.
 */
export function createHardenedDiscoveryAgent(
  deps: HardenedDiscoveryAgentDeps
): HardenedDiscoveryAgent {
  return new HardenedDiscoveryAgent(deps);
}

export function buildRequestEnvelope(
  sessionId: string,
  userId: string,
  organizationId: string
): RequestEnvelope {
  return {
    request_id: uuidv4(),
    trace_id: uuidv4(),
    session_id: sessionId,
    user_id: userId,
    organization_id: organizationId,
    received_at: new Date().toISOString(),
  };
}
