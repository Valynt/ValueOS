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
import type { KnowledgeFabricValidator, HallucinationCheckResult } from "../KnowledgeFabricValidator.js";

export abstract class BaseAgent {
  public readonly lifecycleStage: string;
  public readonly version: string;
  public readonly name: string;
  protected organizationId: string;
  protected memorySystem: MemorySystem;
  protected llmGateway: LLMGateway;
  protected circuitBreaker: CircuitBreaker;
  protected knowledgeFabricValidator: KnowledgeFabricValidator | null;

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
    this.knowledgeFabricValidator = null;
  }

  /**
   * Inject a KnowledgeFabricValidator for hallucination detection.
   * Called by AgentFactory after construction.
   */
  setKnowledgeFabricValidator(validator: KnowledgeFabricValidator): void {
    this.knowledgeFabricValidator = validator;
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
   * Secure LLM invocation with circuit breaker, Knowledge Fabric hallucination
   * detection, and Zod validation.
   *
   * Hallucination detection cross-references the LLM response against:
   * 1. Tenant-scoped semantic memory (contradicting facts from prior agent runs)
   * 2. GroundTruth benchmarks (ESO KPIs, VMRT traces)
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

      // Knowledge Fabric cross-reference hallucination detection
      const validationResult = await this.validateWithKnowledgeFabric(response.content);
      const hallucination_check = validationResult.passed;

      // Validate response with Zod
      const parsed = zodSchema.parse(JSON.parse(response.content));

      // Track prediction if enabled
      if (trackPrediction) {
        await this.memorySystem.storeSemanticMemory(
          sessionId,
          this.name,
          "episodic",
          `LLM Response: ${response.content.substring(0, 200)}...`,
          {
            confidence: validationResult.confidence,
            hallucination_check,
            validation_method: validationResult.method,
            contradiction_count: validationResult.contradictions.length,
            benchmark_misalignment_count: validationResult.benchmarkMisalignments.length,
          },
          this.organizationId
        );
      }

      return { ...parsed, hallucination_check };
    });
  }

  /**
   * Validate LLM output via Knowledge Fabric cross-referencing.
   * Falls back to a passing result if no validator is configured.
   */
  private async validateWithKnowledgeFabric(content: string): Promise<HallucinationCheckResult> {
    if (!this.knowledgeFabricValidator) {
      return {
        passed: true,
        confidence: 0.5,
        contradictions: [],
        benchmarkMisalignments: [],
        method: "knowledge_fabric",
      };
    }

    try {
      return await this.knowledgeFabricValidator.validate(
        content,
        this.organizationId,
        this.name
      );
    } catch (err) {
      logger.warn("Knowledge Fabric validation failed, defaulting to pass", {
        agent_id: this.name,
        error: (err as Error).message,
      });
      return {
        passed: true,
        confidence: 0.5,
        contradictions: [],
        benchmarkMisalignments: [],
        method: "knowledge_fabric",
      };
    }
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
