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

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentConfig {
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
        enabled: true,
      },
      {
        id: "data_analysis",
        name: "Data Analysis",
        description: "Analyze input data",
        enabled: true,
      },
      {
        id: "memory_access",
        name: "Memory Access",
        description: "Access memory system",
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
      health: "healthy",
      performance: this.getPerformanceMetrics(),
    };
  }

  async healthCheck(): Promise<AgentHealthStatus> {
    try {
      // Basic health check - can be extended by subclasses
      const timeSinceLastExecution = Date.now() - this.lastExecutionTime;
      const isHealthy = timeSinceLastExecution < 300000; // 5 minutes

      return isHealthy ? "healthy" : "degraded";
    } catch (error) {
      return "unhealthy";
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
      totalExecutions: this.executionCount,
      averageExecutionTime: 1000, // Default - would be calculated from actual data
      successRate: 0.95, // Default - would be calculated from actual data
      errorRate: 0.05,
      lastExecutionTime: new Date(this.lastExecutionTime),
      memoryUsage: 50, // MB - would be measured
      cacheHitRate: 0.8,
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
    reasoning?: string,
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

  protected async callLLM(request: Omit<LLMRequest, "id">): Promise<LLMResponse> {
    const fullRequest: LLMRequest = {
      id: uuidv4(),
      ...request,
    };

    return await this.config.llmGateway.execute(fullRequest);
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
      organizationId: this.config.organizationId,
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

  destroy(): void {
    logger.info("Agent destroyed", {
      agentId: this.config.id,
      agentType: this.getAgentType(),
    });
  }
}
