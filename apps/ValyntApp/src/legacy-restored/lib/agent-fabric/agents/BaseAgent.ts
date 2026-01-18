/**
 * Base Agent - Abstract class for all ValueOS agents
 *
 * Provides common functionality including:
 * - Configuration management
 * - Logging and telemetry
 * - Error handling
 * - Resource management
 */

import { logger } from "../../../utils/logger";
import { AgentConfig } from "../../../types/agent";
import { v4 as uuidv4 } from "uuid";
import { LLMGateway, LLMRequest, LLMResponse } from "../LLMGateway";
import { MemorySystem, MemoryEntry, MemoryQuery } from "../MemorySystem";
import { AuditLogger, AuditLevel } from "../AuditLogger";
import { createClient } from "@supabase/supabase-js";

// Import types from the correct location
import { AgentType } from "../../../agent-types";
import { ConfidenceLevel } from "../../../types/agent";

export interface AgentRequest {
  sessionId: string;
  input: any;
  context?: Record<string, any>;
}

export interface AgentResponse {
  success: boolean;
  data: any;
  confidence?: ConfidenceLevel;
  assumptions?: any[];
  error?: string;
  metadata?: {
    executionTime: number;
    tokenUsage?: {
      input: number;
      output: number;
      total: number;
      cost: number;
    };
    retryCount?: number;
  };
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected agentId: string;
  protected logger = logger;

  constructor(config: AgentConfig) {
    this.config = config;
    this.agentId = `${config.id}-${uuidv4()}`;
    this.logger = logger.child({ agentId: this.agentId, agentType: config.id });
  }

  /**
   * Main execution method - must be implemented by concrete agents
   */
  abstract execute(
    sessionId: string,
    input: any,
    context?: Record<string, any>
  ): Promise<AgentResponse>;

  /**
   * Get agent capabilities
   */
  abstract getCapabilities(): string[];

  /**
   * Validate input before execution
   */
  protected validateInput(input: any): boolean {
    return input !== null && input !== undefined;
  }

  /**
   * Handle errors consistently across all agents
   */
  protected handleError(error: Error, context?: string): AgentResponse {
    this.logger.error("Agent execution failed", {
      error: error?.message || "Unknown error occurred",
      stack: error.stack,
      context,
    });

    return {
      success: false,
      error: `${context ? `${context}: ` : ""}${error.message}`,
      metadata: {
        executionTime: 0,
      },
    };
  }

  /**
   * Create standardized response
   */
  protected createResponse(
    success: boolean,
    data: any,
    confidence?: ConfidenceLevel,
    assumptions?: any[],
    metadata?: Partial<AgentResponse["metadata"]>
  ): AgentResponse {
    return {
      success,
      data,
      confidence,
      assumptions,
      metadata: {
        executionTime: 0,
        ...metadata,
      },
    };
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Check if agent is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Basic health check - can be overridden by specific agents
      return this.config !== null && this.config !== undefined;
    } catch (error) {
      this.logger.error("Health check failed", { error });
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.logger.info("Cleaning up agent resources");
  }
}
