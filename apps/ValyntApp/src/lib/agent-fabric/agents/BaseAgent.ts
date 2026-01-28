/**
 * Base Agent - Abstract class for all ValueOS agents
 *
 * Provides common functionality including:
 * - Configuration management
 * - Logging and telemetry
 * - Error handling
 * - Resource management
 * - Multi-Agent Reinforcement Learning (MARL) framework
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

/**
 * MARL State representation for agent interactions
 */
export interface MARLState {
  sessionId: string;
  agentStates: Record<string, any>; // State of each participating agent
  sharedContext: Record<string, any>; // Shared context across agents
  interactionHistory: MARLInteraction[]; // History of interactions
  timestamp: number;
}

/**
 * MARL Action representation
 */
export interface MARLAction {
  agentId: string;
  actionType: string;
  parameters: Record<string, any>;
  confidence: number; // 0-1
  timestamp: number;
}

/**
 * MARL Interaction record
 */
export interface MARLInteraction {
  interactionId: string;
  state: MARLState;
  actions: MARLAction[];
  rewards: Record<string, number>; // Rewards for each agent
  nextState: MARLState;
  timestamp: number;
}

/**
 * MARL Reward function interface
 */
export interface MARLRewardFunction {
  calculateReward(
    state: MARLState,
    action: MARLAction,
    nextState: MARLState,
    agentId: string
  ): number;
}

/**
 * MARL Policy interface
 */
export interface MARLPolicy {
  selectAction(state: MARLState, agentId: string): Promise<MARLAction>;
  updatePolicy(interaction: MARLInteraction): Promise<void>;
}

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
  protected marlEnabled: boolean = false;
  protected marlPolicy?: MARLPolicy;
  protected marlRewardFunction?: MARLRewardFunction;
  protected marlMemory: MARLInteraction[] = [];

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
   * Enable MARL capabilities for this agent
   */
  enableMARL(policy: MARLPolicy, rewardFunction: MARLRewardFunction): void {
    this.marlEnabled = true;
    this.marlPolicy = policy;
    this.marlRewardFunction = rewardFunction;
    this.logger.info("MARL capabilities enabled", { agentId: this.agentId });
  }

  /**
   * Disable MARL capabilities
   */
  disableMARL(): void {
    this.marlEnabled = false;
    this.marlPolicy = undefined;
    this.marlRewardFunction = undefined;
    this.logger.info("MARL capabilities disabled", { agentId: this.agentId });
  }

  /**
   * Check if MARL is enabled
   */
  isMARLEnabled(): boolean {
    return this.marlEnabled;
  }

  /**
   * Execute MARL action selection
   */
  async selectMARLAction(state: MARLState): Promise<MARLAction | null> {
    if (!this.marlEnabled || !this.marlPolicy) {
      return null;
    }

    try {
      return await this.marlPolicy.selectAction(state, this.agentId);
    } catch (error) {
      this.logger.error("MARL action selection failed", { error, agentId: this.agentId });
      return null;
    }
  }

  /**
   * Update MARL policy based on interaction
   */
  async updateMARLPolicy(interaction: MARLInteraction): Promise<void> {
    if (!this.marlEnabled || !this.marlPolicy) {
      return;
    }

    try {
      await this.marlPolicy.updatePolicy(interaction);
      this.marlMemory.push(interaction);

      // Limit memory size to prevent unbounded growth
      if (this.marlMemory.length > 1000) {
        this.marlMemory = this.marlMemory.slice(-500);
      }
    } catch (error) {
      this.logger.error("MARL policy update failed", { error, agentId: this.agentId });
    }
  }

  /**
   * Calculate MARL reward for an action
   */
  calculateMARLReward(state: MARLState, action: MARLAction, nextState: MARLState): number {
    if (!this.marlEnabled || !this.marlRewardFunction) {
      return 0;
    }

    try {
      return this.marlRewardFunction.calculateReward(state, action, nextState, this.agentId);
    } catch (error) {
      this.logger.error("MARL reward calculation failed", { error, agentId: this.agentId });
      return 0;
    }
  }

  /**
   * Get MARL interaction history
   */
  getMARLHistory(): MARLInteraction[] {
    return [...this.marlMemory];
  }

  /**
   * Share episodic memory with other agents
   */
  async shareEpisodicMemory(otherAgent: BaseAgent): Promise<void> {
    if (!this.marlEnabled) {
      return;
    }

    // Share recent interactions for collaborative learning
    const recentInteractions = this.marlMemory.slice(-10);
    // Note: In a real implementation, this would involve secure memory sharing protocols
    this.logger.info("Shared episodic memory", {
      agentId: this.agentId,
      otherAgentId: otherAgent.getAgentId(),
      interactionsShared: recentInteractions.length,
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.logger.info("Cleaning up agent resources");
    this.marlMemory = [];
  }
}
