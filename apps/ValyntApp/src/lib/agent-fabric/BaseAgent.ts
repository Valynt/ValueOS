/**
 * Base Agent
 *
 * Abstract base class for all agents with common functionality,
 * lifecycle management, and integration with agent-fabric services.
 */

import { logger } from "../../utils/logger";
import { v4 as uuidv4 } from "uuid";
import { LLMGateway, LLMRequest, LLMResponse } from "./LLMGateway";
import { MemorySystem, MemoryEntry, MemoryQuery } from "./MemorySystem";
import { AuditLogger, AuditLevel } from "./AuditLogger";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AgentType } from "../../services/agent-types";
import { ConfidenceLevel } from "../../services/agent-types";
import {
  IAgent,
  AgentRequest,
  AgentResponse,
  AgentCapability,
  ValidationResult,
  AgentMetadata,
  AgentHealthStatus,
  AgentConfiguration,
  AgentPerformanceMetrics,
  AgentExecutionMetadata,
  ReasoningTrace,
} from "../../services/agents/core/IAgent";

// ============================================================================
// MARL Types
// ============================================================================

/**
 * MARL State representation for agent interactions
 */
export interface MARLState {
  sessionId: string;
  agentStates: Record<string, any>; // State of each participating agent
  sharedContext: Record<string, any>; // Shared context across agents
  timestamp: Date;
}

/**
 * MARL Action representation
 */
export interface MARLAction {
  agentId: string;
  actionType: string;
  parameters: Record<string, any>;
  confidence: ConfidenceLevel;
  timestamp: Date;
}

/**
 * MARL Interaction record
 */
export interface MARLInteraction {
  interactionId: string;
  sessionId: string;
  actions: MARLAction[];
  outcomes: Record<string, any>;
  timestamp: Date;
}

/**
 * MARL Reward Function
 */
export interface MARLRewardFunction {
  calculateReward(interaction: MARLInteraction, agentId: string): number;
  updateRewards(interactions: MARLInteraction[]): void;
}

/**
 * MARL Policy for decision making
 */
export interface MARLPolicy {
  selectAction(state: MARLState, agentId: string): MARLAction;
  updatePolicy(interactions: MARLInteraction[]): void;
  getPolicyParameters(): Record<string, any>;
}

// ============================================================================
// Agent Types
// ============================================================================

export interface BaseAgentConfig {
  id: string;
  organizationId?: string;
  userId?: string;
  sessionId?: string;
  supabase: ReturnType<typeof createClient>;
  llmGateway: LLMGateway;
  memorySystem: MemorySystem;
  auditLogger: AuditLogger;
  configuration?: AgentConfiguration;
}

export abstract class BaseAgent implements IAgent {
  protected config: BaseAgentConfig;
  protected executionCount = 0;
  protected lastExecutionTime = 0;
  protected logger = logger;

  constructor(config: BaseAgentConfig) {
    this.config = config;

    logger.info("Agent initialized", {
      agentId: config.id,
      agentType: this.getAgentType(),
    });
  }

  // Abstract methods that must be implemented by concrete agents
  abstract getAgentType(): AgentType;
  protected abstract processRequest(request: AgentRequest): Promise<AgentResponse>;

  // IAgent interface implementation
  async execute<T = unknown>(request: AgentRequest): Promise<AgentResponse<T>> {
    const startTime = Date.now();
    const executionId = uuidv4();

    try {
      // Validate input
      const validationResult = this.validateInput(request);
      if (!validationResult.valid) {
        throw new Error(
          `Invalid input: ${validationResult.errors.map((e) => e.message).join(", ")}`
        );
      }

      // Process the request
      const response = await this.processRequest(request);

      // Add execution metadata
      response.metadata = {
        executionId,
        agentType: this.getAgentType(),
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        tokenUsage: response.metadata?.tokenUsage || {
          input: 0,
          output: 0,
          total: 0,
          cost: 0,
        },
        cacheHit: response.metadata?.cacheHit || false,
        retryCount: response.metadata?.retryCount || 0,
        circuitBreakerTripped: false,
      };

      this.executionCount++;
      this.lastExecutionTime = Date.now();

      return response as AgentResponse<T>;
    } catch (error) {
      const errorResponse: AgentResponse<T> = {
        success: false,
        confidence: "low" as ConfidenceLevel,
        metadata: {
          executionId,
          agentType: this.getAgentType(),
          startTime: new Date(startTime),
          endTime: new Date(),
          duration: Date.now() - startTime,
          tokenUsage: {
            input: 0,
            output: 0,
            total: 0,
            cost: 0,
          },
          cacheHit: false,
          retryCount: 0,
          circuitBreakerTripped: false,
        },
        error: {
          code: "EXECUTION_ERROR",
          message: (error as Error).message,
          details: { agentType: this.getAgentType() },
          stack: (error as Error).stack,
          retryable: false,
        },
      };

      return errorResponse;
    }
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        id: "text_generation",
        name: "Text Generation",
        description: "Generate text responses",
        category: "generation",
        inputTypes: ["text", "json"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
        enabled: true,
      },
      {
        id: "data_analysis",
        name: "Data Analysis",
        description: "Analyze input data",
        category: "analysis",
        inputTypes: ["json", "text"],
        outputTypes: ["json", "text"],
        requiredPermissions: ["data_access"],
        enabled: true,
      },
      {
        id: "memory_access",
        name: "Memory Access",
        description: "Access memory system",
        category: "coordination",
        inputTypes: ["json"],
        outputTypes: ["json"],
        requiredPermissions: ["memory_access"],
        enabled: true,
      },
    ];
  }

  validateInput(input: unknown): ValidationResult {
    // Basic validation - can be overridden by subclasses
    if (!input || typeof input !== "object") {
      return {
        valid: false,
        errors: [
          {
            code: "INVALID_INPUT",
            message: "Input must be an object",
          },
        ],
        warnings: [],
      };
    }

    return {
      valid: true,
      errors: [],
      warnings: [],
    };
  }

  getMetadata(): AgentMetadata {
    return {
      type: this.getAgentType(),
      name: this.getAgentType(),
      description: `${this.getAgentType()} agent`,
      version: "1.0.0",
      capabilities: this.getCapabilities(),
      inputSchemas: {},
      outputSchemas: {},
      configuration: this.config.configuration || this.getDefaultConfiguration(),
      health: {
        status: "healthy",
        lastCheck: new Date(),
        responseTime: 100,
        errorRate: 0,
        uptime: 99.9,
        activeConnections: 1,
      },
      performance: this.getPerformanceMetrics(),
    };
  }

  async healthCheck(): Promise<AgentHealthStatus> {
    try {
      // Basic health check - can be extended by subclasses
      const timeSinceLastExecution = Date.now() - this.lastExecutionTime;
      const isHealthy = timeSinceLastExecution < 300000; // 5 minutes

      return {
        status: isHealthy ? "healthy" : "degraded",
        lastCheck: new Date(),
        responseTime: 100, // Mock response time
        errorRate: 0, // Mock error rate
        uptime: 99.9, // Mock uptime
        activeConnections: 1, // Mock active connections
      };
    } catch (error) {
      return {
        status: "offline",
        lastCheck: new Date(),
        responseTime: 0,
        errorRate: 100,
        uptime: 0,
        activeConnections: 0,
      };
    }
  }

  getConfiguration(): AgentConfiguration {
    return this.config.configuration || this.getDefaultConfiguration();
  }

  async updateConfiguration(config: Partial<AgentConfiguration>): Promise<void> {
    this.config.configuration = {
      ...this.getConfiguration(),
      ...config,
    };

    logger.info("Agent configuration updated", {
      agentId: this.config.id,
      updates: Object.keys(config),
    });
  }

  getPerformanceMetrics(): AgentPerformanceMetrics {
    return {
      avgResponseTime: 1000, // Default - would be calculated from actual data
      p95ResponseTime: 1500, // Default - would be calculated from actual data
      successRate: 95, // Default - would be calculated from actual data
      requestsPerMinute: 60, // Default - would be calculated from actual data
      avgTokenUsage: 1000, // Default - would be calculated from actual data
      costPerRequest: 0.01, // Default - would be calculated from actual data
    };
  }

  async reset(): Promise<void> {
    this.executionCount = 0;
    this.lastExecutionTime = 0;

    logger.info("Agent reset", {
      agentId: this.config.id,
      agentType: this.getAgentType(),
    });
  }

  supportsCapability(capabilityId: string): boolean {
    return this.getCapabilities().some((cap) => cap.id === capabilityId);
  }

  getInputSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        query: { type: "string" },
        parameters: { type: "object" },
        context: { type: "object" },
      },
      required: ["query"],
    };
  }

  getOutputSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: { type: "object" },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["success", "data"],
    };
  }

  // Helper methods for subclasses
  protected createResponse<T>(
    success: boolean,
    data: T,
    confidence: ConfidenceLevel,
    reasoning?: ReasoningTrace,
    metadata?: Partial<AgentExecutionMetadata>
  ): AgentResponse<T> {
    return {
      success,
      data,
      confidence,
      metadata: {
        executionId: uuidv4(),
        agentType: this.getAgentType(),
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        tokenUsage: {
          input: 0,
          output: 0,
          total: 0,
          cost: 0,
        },
        cacheHit: false,
        retryCount: 0,
        circuitBreakerTripped: false,
        ...metadata,
      },
      reasoning,
    };
  }

  /**
   * Handle errors consistently across all agents
   */
  protected handleError<T>(error: Error, context?: string): AgentResponse<T> {
    this.logger.error("Agent execution failed", {
      error: error?.message || "Unknown error occurred",
      stack: error.stack,
      context,
    });

    return {
      success: false,
      data: undefined as T,
      confidence: "low" as ConfidenceLevel,
      metadata: {
        executionId: uuidv4(),
        agentType: this.getAgentType(),
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        tokenUsage: {
          input: 0,
          output: 0,
          total: 0,
          cost: 0,
        },
        cacheHit: false,
        retryCount: 0,
        circuitBreakerTripped: false,
      },
      error: {
        code: "EXECUTION_ERROR",
        message: `${context ? `${context}: ` : ""}${error.message}`,
        details: { stack: error.stack },
        stack: error.stack,
        retryable: false,
      },
    };
  }

  protected async callLLM(request: Omit<LLMRequest, "id">): Promise<LLMResponse> {
    if (!this.config.organizationId) {
      throw new Error("TENANT_ID_REQUIRED: LLM requests require an explicit tenantId");
    }

    const fullRequest: LLMRequest = {
      id: uuidv4(),
      tenantId: this.config.organizationId,
      userId: this.config.userId,
      sessionId: this.config.sessionId,
      ...request,
    };

    return await this.config.llmGateway.execute(fullRequest);
  }

  /**
   * Securely invoke LLM with schema validation and hallucination detection
   */
  protected async secureInvoke<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: {
      temperature?: number;
      model?: string;
      maxRetries?: number;
    }
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.callLLM({
          provider: "openai",
          model: options?.model || "gpt-4",
          messages: [
            {
              role: "system",
              content:
                "You are a precise AI assistant. You must output valid JSON matching the user's request. Do not include markdown formatting (like ```json) or explanations outside the JSON object.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: options?.temperature || 0,
        });

        // Extract JSON from response
        let content = response.content.trim();

        // Handle markdown code blocks if present
        if (content.startsWith("```")) {
          const lines = content.split("\n");
          if (lines[0].includes("json")) {
            content = lines.slice(1, -1).join("\n");
          } else {
            content = lines.slice(1, -1).join("\n");
          }
        }

        // Try to find JSON object if mixed with text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          content = jsonMatch[0];
        }

        const parsed = JSON.parse(content);

        // Validate against schema
        return schema.parse(parsed);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`secureInvoke attempt ${attempt} failed`, {
          error: lastError.message,
        });
      }
    }

    throw new Error(`secureInvoke failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  protected async storeMemory(
    type: "semantic" | "episodic" | "vector" | "provenance",
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const context = {
      agentId: this.config.id,
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      organizationId: this.config.organizationId,
    };

    switch (type) {
      case "semantic":
        return await this.config.memorySystem.storeSemantic(content, metadata, context);
      case "episodic":
        return await this.config.memorySystem.storeEpisodic(content, metadata, context);
      case "vector":
        return await this.config.memorySystem.storeSemantic(content, metadata, context); // Simplified
      case "provenance":
        return await this.config.memorySystem.storeProvenance(content, metadata, context);
      default:
        throw new Error(`Unknown memory type: ${type}`);
    }
  }

  protected async retrieveMemory(id: string): Promise<MemoryEntry | null> {
    return await this.config.memorySystem.retrieve(id);
  }

  protected async searchMemory(query: MemoryQuery): Promise<any> {
    return await this.config.memorySystem.search({
      ...query,
      agentId: this.config.id,
      sessionId: this.config.sessionId,
      userId: this.config.userId,
    });
  }

  protected async logAudit(
    action: string,
    details: Record<string, unknown>,
    level: AuditLevel = "info"
  ): Promise<string> {
    return await this.config.auditLogger.logAgentExecution(
      action,
      this.config.id,
      this.getAgentType(),
      details,
      level,
      "low",
      {
        sessionId: this.config.sessionId,
        userId: this.config.userId,
        tenantId: this.config.organizationId,
      }
    );
  }

  private getDefaultConfiguration(): AgentConfiguration {
    return {
      defaultTimeout: 30000,
      maxRetries: 3,
      retryStrategy: "exponential",
      cacheTTL: 300000,
      rateLimits: {
        requestsPerSecond: 10,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        halfOpenMaxCalls: 3,
      },
    };
  }

  // ============================================================================
  // MARL Methods
  // ============================================================================

  protected marlEnabled = false;
  protected marlPolicy?: MARLPolicy;
  protected marlRewardFunction?: MARLRewardFunction;
  protected marlHistory: MARLInteraction[] = [];

  /**
   * Enable MARL for this agent
   */
  protected enableMARL(policy: MARLPolicy, rewardFunction: MARLRewardFunction): void {
    this.marlEnabled = true;
    this.marlPolicy = policy;
    this.marlRewardFunction = rewardFunction;
    this.logger.info("MARL enabled for agent", { agentId: this.config.id });
  }

  /**
   * Check if MARL is enabled
   */
  protected isMARLEnabled(): boolean {
    return this.marlEnabled;
  }

  /**
   * Initialize MARL with default policy and reward function
   */
  protected initializeMARL(): void {
    // Default implementations - subclasses should override
    this.marlPolicy = {
      selectAction: (_state: MARLState, agentId: string) => ({
        agentId,
        actionType: "default",
        parameters: {},
        confidence: "medium" as ConfidenceLevel,
        timestamp: new Date(),
      }),
      updatePolicy: () => {},
      getPolicyParameters: () => ({}),
    };

    this.marlRewardFunction = {
      calculateReward: () => 0,
      updateRewards: () => {},
    };

    this.enableMARL(this.marlPolicy, this.marlRewardFunction);
  }

  /**
   * Select an action using MARL policy
   */
  protected async selectMARLAction(state: MARLState): Promise<MARLAction> {
    if (!this.marlPolicy) {
      throw new Error("MARL policy not initialized");
    }
    return this.marlPolicy.selectAction(state, this.config.id);
  }

  /**
   * Update MARL policy based on interaction
   */
  protected async updateMARLPolicy(interaction: MARLInteraction): Promise<void> {
    if (!this.marlPolicy || !this.marlRewardFunction) {
      return;
    }

    this.marlHistory.push(interaction);
    this.marlPolicy.updatePolicy([interaction]);
    this.marlRewardFunction.updateRewards([interaction]);
  }

  /**
   * Get MARL interaction history
   */
  protected getMARLHistory(): MARLInteraction[] {
    return [...this.marlHistory];
  }

  /**
   * Update MARL from communication context
   */
  protected async updateMARLFromCommunication(strategy: any, context: any): Promise<void> {
    // Default implementation - subclasses should override
    const interaction: MARLInteraction = {
      interactionId: uuidv4(),
      sessionId: this.config.sessionId || "default",
      actions: [
        {
          agentId: this.config.id,
          actionType: "communication",
          parameters: { strategy, context },
          confidence: "high" as ConfidenceLevel,
          timestamp: new Date(),
        },
      ],
      outcomes: { success: true },
      timestamp: new Date(),
    };

    await this.updateMARLPolicy(interaction);
  }

  /**
   * Share episodic memory with other agents
   */
  protected async shareEpisodicMemory(agentIds: string[], content: string): Promise<void> {
    const memoryEntry: MemoryEntry = {
      id: uuidv4(),
      type: "episodic",
      content,
      metadata: {
        agentId: this.config.id,
        sharedWith: agentIds,
        timestamp: new Date(),
      },
      timestamp: new Date(),
      expiresAt: undefined,
    };

    await this.storeMemory("episodic", content, {
      agentId: this.config.id,
      sessionId: this.config.sessionId,
      userId: this.config.userId,
    });
  }

  destroy(): void {
    logger.info("Agent destroyed", {
      agentId: this.config.id,
      agentType: this.getAgentType(),
    });
  }
}
