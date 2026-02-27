/**
 * Base Agent
 *
 * Abstract base class for all agents in the agent fabric
 */

import { logger } from "../../logger.js";
import { z } from "zod";
import type { AgentConfig, AgentOutput, AgentOutputStatus, LifecycleContext, LifecycleStage } from "../../../types/agent.js";
import type { AgentType } from "../../../services/agent-types.js";
import { LLMGateway } from "../LLMGateway.js";
import { CircuitBreaker } from "../CircuitBreaker.js";
import { MemorySystem } from "../MemorySystem.js";

export abstract class BaseAgent {
  public readonly lifecycleStage: string;
  public readonly version: string;
  public readonly name: string;
  protected organizationId: string;
  protected memorySystem: MemorySystem;
  protected llmGateway: LLMGateway;
  protected circuitBreaker: CircuitBreaker;

  constructor(
    config: AgentConfig,
    organizationId: string,
    memorySystem: MemorySystem,
    llmGateway: LLMGateway,
    circuitBreaker: CircuitBreaker
  ) {
    this.lifecycleStage = config.lifecycle_stage;
    this.version = "1.0.0"; // Default version, can be overridden
    this.name = config.name;
    this.organizationId = organizationId;
    this.memorySystem = memorySystem;
    this.llmGateway = llmGateway;
    this.circuitBreaker = circuitBreaker;
  }

  abstract execute(context: LifecycleContext): Promise<AgentOutput>;

  async validateInput(context: LifecycleContext): Promise<boolean> {
    if (!context.workspace_id || !context.organization_id || !context.user_id) {
      logger.error("Invalid agent input context", {
        agent_id: this.name,
        has_workspace: !!context.workspace_id,
        has_org: !!context.organization_id,
        has_user: !!context.user_id,
      });
      return false;
    }
    this.organizationId = context.organization_id;
    return true;
  }

  async prepareOutput(result: Record<string, unknown>, status: AgentOutputStatus): Promise<AgentOutput> {
    return {
      agent_id: this.name,
      agent_type: this.lifecycleStage as AgentType,
      lifecycle_stage: this.lifecycleStage as LifecycleStage,
      status,
      result,
      confidence: "medium",
      metadata: {
        execution_time_ms: 0,
        model_version: "unknown",
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Secure LLM invocation with circuit breaker, hallucination detection, and Zod validation
   */
  protected async secureInvoke<T>(
    sessionId: string,
    prompt: string,
    zodSchema: z.ZodSchema<T>,
    options: {
      trackPrediction?: boolean;
      confidenceThresholds?: { low: number; high: number };
      context?: Record<string, unknown>;
      idempotencyKey?: string;
    } = {}
  ): Promise<T & { hallucination_check?: boolean }> {
    const {
      trackPrediction = true,
      confidenceThresholds = { low: 0.6, high: 0.85 },
      context = {},
      idempotencyKey,
    } = options;

    return this.circuitBreaker.execute(async () => {
      const request = {
        messages: [{ role: "user" as const, content: prompt }],
        metadata: {
          tenantId: this.organizationId,
          sessionId,
          userId: "system", // Default for agents
          idempotencyKey,
          ...context,
        },
      };

      const response = await this.llmGateway.complete(request);

      // Basic hallucination check (placeholder - implement proper detection)
      const hallucination_check = this.checkHallucination(response.content);

      // Validate response with Zod
      const parsed = zodSchema.parse(JSON.parse(response.content));

      // Track prediction if enabled
      if (trackPrediction) {
        await this.memorySystem.storeSemanticMemory(
          sessionId,
          this.name,
          "episodic",
          `LLM Response: ${response.content.substring(0, 200)}...`,
          { confidence: 0.8, hallucination_check },
          this.organizationId
        );
      }

      return { ...parsed, hallucination_check };
    });
  }

  /**
   * Basic hallucination detection (placeholder implementation)
   */
  private checkHallucination(content: string): boolean {
    // Placeholder: Implement proper hallucination detection
    // For now, check for common hallucination patterns
    const hallucinationPatterns = [
      /I'm sorry, but I cannot/i,
      /I don't have access to/i,
      /As an AI, I must/i,
    ];

    return !hallucinationPatterns.some((pattern) => pattern.test(content));
  }

  getCapabilities(): string[] {
    return [];
  }

  getId(): string {
    return this.name;
  }

  getName(): string {
    return this.name;
  }
}
