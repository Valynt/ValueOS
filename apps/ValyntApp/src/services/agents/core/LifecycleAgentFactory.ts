/**
 * Lifecycle Agent Factory
 *
 * CONSOLIDATION: Factory implementation for creating lifecycle stage agents
 * with unified configuration and dependency injection.
 *
 * with a centralized, testable factory pattern.
 */

import { createClient } from "@supabase/supabase-js";

import { logger } from "../../../utils/logger";
import { AgentType } from "../../agent-types";

import { AgentConfiguration, IAgent, IAgentFactory } from "./IAgent";


// TODO(ticket:VOS-DEBT-1427 owner:team-valueos date:2026-02-13): Import these when agent-fabric is migrated
// import { LLMGateway } from '../../lib/agent-fabric/LLMGateway';
// import { MemorySystem } from '../../lib/agent-fabric/MemorySystem';
// import { AuditLogger } from '../../lib/agent-fabric/AuditLogger';

// Temporary placeholders until migration
interface LLMGateway {
  // Placeholder interface
}

interface MemorySystem {
  // Placeholder interface
}

interface AuditLogger {
  // Placeholder interface
}

// ============================================================================
// Agent Configuration
// ============================================================================

const DEFAULT_AGENT_CONFIGURATIONS: Partial<Record<AgentType, AgentConfiguration>> = {
  opportunity: {
    defaultTimeout: 30000,
    maxRetries: 3,
    retryStrategy: "exponential",
    cacheTTL: 300000, // 5 minutes
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
  },
  target: {
    defaultTimeout: 45000,
    maxRetries: 3,
    retryStrategy: "exponential",
    cacheTTL: 600000, // 10 minutes
    rateLimits: {
      requestsPerSecond: 8,
      requestsPerMinute: 80,
      requestsPerHour: 800,
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      halfOpenMaxCalls: 3,
    },
  },
  expansion: {
    defaultTimeout: 60000,
    maxRetries: 3,
    retryStrategy: "exponential",
    cacheTTL: 900000, // 15 minutes
    rateLimits: {
      requestsPerSecond: 6,
      requestsPerMinute: 60,
      requestsPerHour: 600,
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      halfOpenMaxCalls: 3,
    },
  },
  integrity: {
    defaultTimeout: 90000,
    maxRetries: 2,
    retryStrategy: "linear",
    cacheTTL: 1200000, // 20 minutes
    rateLimits: {
      requestsPerSecond: 4,
      requestsPerMinute: 40,
      requestsPerHour: 400,
    },
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeout: 90000,
      halfOpenMaxCalls: 2,
    },
  },
  realization: {
    defaultTimeout: 120000,
    maxRetries: 2,
    retryStrategy: "linear",
    cacheTTL: 1800000, // 30 minutes
    rateLimits: {
      requestsPerSecond: 2,
      requestsPerMinute: 20,
      requestsPerHour: 200,
    },
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeout: 120000,
      halfOpenMaxCalls: 2,
    },
  },
  // Additional agent types with default configurations
  "financial-modeling": {
    defaultTimeout: 60000,
    maxRetries: 3,
    retryStrategy: "exponential",
    cacheTTL: 900000,
    rateLimits: {
      requestsPerSecond: 8,
      requestsPerMinute: 80,
      requestsPerHour: 800,
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      halfOpenMaxCalls: 3,
    },
  },
  "company-intelligence": {
    defaultTimeout: 90000,
    maxRetries: 3,
    retryStrategy: "exponential",
    cacheTTL: 1800000,
    rateLimits: {
      requestsPerSecond: 4,
      requestsPerMinute: 40,
      requestsPerHour: 400,
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 90000,
      halfOpenMaxCalls: 3,
    },
  },
  "value-mapping": {
    defaultTimeout: 45000,
    maxRetries: 3,
    retryStrategy: "exponential",
    cacheTTL: 600000,
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
  },
  "system-mapper": {
    defaultTimeout: 120000,
    maxRetries: 2,
    retryStrategy: "linear",
    cacheTTL: 2400000,
    rateLimits: {
      requestsPerSecond: 2,
      requestsPerMinute: 20,
      requestsPerHour: 200,
    },
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeout: 120000,
      halfOpenMaxCalls: 2,
    },
  },
  "intervention-designer": {
    defaultTimeout: 90000,
    maxRetries: 3,
    retryStrategy: "exponential",
    cacheTTL: 1200000,
    rateLimits: {
      requestsPerSecond: 6,
      requestsPerMinute: 60,
      requestsPerHour: 600,
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 90000,
      halfOpenMaxCalls: 3,
    },
  },
  "outcome-engineer": {
    defaultTimeout: 75000,
    maxRetries: 3,
    retryStrategy: "exponential",
    cacheTTL: 900000,
    rateLimits: {
      requestsPerSecond: 8,
      requestsPerMinute: 80,
      requestsPerHour: 800,
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      halfOpenMaxCalls: 3,
    },
  },
  coordinator: {
    defaultTimeout: 30000,
    maxRetries: 3,
    retryStrategy: "exponential",
    cacheTTL: 300000,
    rateLimits: {
      requestsPerSecond: 15,
      requestsPerMinute: 150,
      requestsPerHour: 1500,
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      halfOpenMaxCalls: 3,
    },
  },
  "value-eval": {
    defaultTimeout: 60000,
    maxRetries: 3,
    retryStrategy: "exponential",
    cacheTTL: 600000,
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
  },
  communicator: {
    defaultTimeout: 45000,
    maxRetries: 3,
    retryStrategy: "exponential",
    cacheTTL: 300000,
    rateLimits: {
      requestsPerSecond: 20,
      requestsPerMinute: 200,
      requestsPerHour: 2000,
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      halfOpenMaxCalls: 3,
    },
  },
};

// ============================================================================
// Agent Dependencies
// ============================================================================

export interface AgentDependencies {
  supabase: ReturnType<typeof createClient>;
  llmGateway: LLMGateway;
  memorySystem: MemorySystem;
  auditLogger: AuditLogger;
}

// ============================================================================
// Lifecycle Agent Factory Implementation
// ============================================================================

/**
 * Factory for creating lifecycle stage agents
 */
export class LifecycleAgentFactory implements IAgentFactory {
  private dependencies: AgentDependencies;
  private agentCache: Map<string, IAgent> = new Map();

  constructor(dependencies: AgentDependencies) {
    this.dependencies = dependencies;
    logger.info("LifecycleAgentFactory initialized", {
      supportedAgents: this.getSupportedAgentTypes(),
    });
  }

  /**
   * Create an agent of the given type
   */
  async createAgent(agentType: AgentType, config?: Partial<AgentConfiguration>): Promise<IAgent> {
    const cacheKey = `${agentType}-${JSON.stringify(config || {})}`;

    // Check cache first
    if (this.agentCache.has(cacheKey)) {
      logger.debug("Agent found in cache", { agentType, cacheKey });
      return this.agentCache.get(cacheKey)!;
    }

    try {
      const finalConfig = this.mergeConfiguration(agentType, config);
      const agent = await this.instantiateAgent(agentType, finalConfig);

      // Cache the agent
      this.agentCache.set(cacheKey, agent);

      logger.info("Agent created successfully", {
        agentType,
        config: finalConfig,
      });

      return agent;
    } catch (error) {
      logger.error("Failed to create agent", {
        agentType,
        errorMessage: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  /**
   * Get supported agent types
   */
  getSupportedAgentTypes(): AgentType[] {
    return Object.keys(DEFAULT_AGENT_CONFIGURATIONS) as AgentType[];
  }

  /**
   * Check if an agent type is supported
   */
  supportsAgentType(agentType: AgentType): boolean {
    return this.getSupportedAgentTypes().includes(agentType);
  }

  /**
   * Get default configuration for an agent type
   */
  getDefaultConfiguration(agentType: AgentType): AgentConfiguration {
    const config = DEFAULT_AGENT_CONFIGURATIONS[agentType];
    if (!config) {
      throw new Error(`No default configuration found for agent type: ${agentType}`);
    }
    return { ...config };
  }

  /**
   * Clear agent cache
   */
  clearCache(): void {
    this.agentCache.clear();
    logger.info("Agent cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    agents: Array<{ type: AgentType; cacheKey: string }>;
  } {
    const agents = Array.from(this.agentCache.entries()).map(([cacheKey, agent]) => ({
      type: agent.getAgentType(),
      cacheKey,
    }));

    return {
      size: this.agentCache.size,
      agents,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Merge default configuration with provided configuration
   */
  private mergeConfiguration(
    agentType: AgentType,
    config?: Partial<AgentConfiguration>
  ): AgentConfiguration {
    const defaultConfig = this.getDefaultConfiguration(agentType);

    if (!config) {
      return defaultConfig;
    }

    return {
      defaultTimeout: config.defaultTimeout ?? defaultConfig.defaultTimeout,
      maxRetries: config.maxRetries ?? defaultConfig.maxRetries,
      retryStrategy: config.retryStrategy ?? defaultConfig.retryStrategy,
      cacheTTL: config.cacheTTL ?? defaultConfig.cacheTTL,
      rateLimits: {
        ...defaultConfig.rateLimits,
        ...config.rateLimits,
      },
      circuitBreaker: {
        ...defaultConfig.circuitBreaker,
        ...config.circuitBreaker,
      },
    };
  }

  /**
   * Instantiate an agent of the given type
   */
  private async instantiateAgent(
    agentType: AgentType,
    config: AgentConfiguration
  ): Promise<IAgent> {
    // Import agent classes dynamically to avoid circular dependencies
    const agentClasses = await this.loadAgentClasses();

    const AgentClass = agentClasses[agentType];
    if (!AgentClass) {
      throw new Error(
        `Agent class not found for type: ${agentType}. Agent may not be implemented yet.`
      );
    }

    // Create agent configuration
    const agentConfig = {
      id: `${agentType}-agent`,
      configuration: config,
      dependencies: this.dependencies,
    };

    // Instantiate the agent
    const agent = new AgentClass(agentConfig);

    logger.debug("Agent instantiated", {
      agentType,
      agentClass: AgentClass.name,
      config,
    });

    return agent;
  }

  /**
   * Load agent classes dynamically
   */
  private async loadAgentClasses(): Promise<
    Partial<Record<AgentType, new (config: unknown) => IAgent>>
  > {
    const agentClasses: Partial<Record<AgentType, new (config: unknown) => IAgent>> = {};

    try {
      // Import lifecycle agents from agent-fabric
      const { OpportunityAgent } =
        await import("../../../lib/agent-fabric/agents/OpportunityAgent");
      const { TargetAgent } = await import("../../../lib/agent-fabric/agents/TargetAgent");
      const { ExpansionAgent } = await import("../../../lib/agent-fabric/agents/ExpansionAgent");
      const { IntegrityAgent } = await import("../../../lib/agent-fabric/agents/IntegrityAgent");
      const { RealizationAgent } =
        await import("../../../lib/agent-fabric/agents/RealizationAgent");

      // Map agent types to classes
      agentClasses.opportunity = OpportunityAgent;
      agentClasses.target = TargetAgent;
      agentClasses.expansion = ExpansionAgent;
      agentClasses.integrity = IntegrityAgent;
      agentClasses.realization = RealizationAgent;

      logger.debug("Agent classes loaded successfully", {
        loadedTypes: Object.keys(agentClasses),
      });
    } catch (error) {
      logger.error("Failed to load agent classes", {
        errorMessage: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }

    return agentClasses;
  }
}

// ============================================================================
// Factory Singleton
// ============================================================================

let factoryInstance: LifecycleAgentFactory | null = null;

/**
 * Get or create the singleton factory instance
 */
export function getLifecycleAgentFactory(dependencies: AgentDependencies): LifecycleAgentFactory {
  if (!factoryInstance) {
    factoryInstance = new LifecycleAgentFactory(dependencies);
  }
  return factoryInstance;
}

/**
 * Reset the factory singleton (useful for testing)
 */
export function resetLifecycleAgentFactory(): void {
  factoryInstance = null;
}

// ============================================================================
// Factory Utilities
// ============================================================================

/**
 * Create agent dependencies from existing services
 */
export function createAgentDependencies(
  supabase: ReturnType<typeof createClient>,
  llmGateway: LLMGateway,
  memorySystem: MemorySystem,
  auditLogger: AuditLogger
): AgentDependencies {
  return {
    supabase,
    llmGateway,
    memorySystem,
    auditLogger,
  };
}

/**
 * Validate agent configuration
 */
export function validateAgentConfiguration(config: AgentConfiguration): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.defaultTimeout <= 0) {
    errors.push("defaultTimeout must be greater than 0");
  }

  if (config.maxRetries < 0) {
    errors.push("maxRetries must be non-negative");
  }

  if (config.cacheTTL < 0) {
    errors.push("cacheTTL must be non-negative");
  }

  if (config.rateLimits.requestsPerSecond <= 0) {
    errors.push("requestsPerSecond must be greater than 0");
  }

  if (config.rateLimits.requestsPerMinute <= 0) {
    errors.push("requestsPerMinute must be greater than 0");
  }

  if (config.rateLimits.requestsPerHour <= 0) {
    errors.push("requestsPerHour must be greater than 0");
  }

  if (config.circuitBreaker.failureThreshold <= 0) {
    errors.push("failureThreshold must be greater than 0");
  }

  if (config.circuitBreaker.recoveryTimeout <= 0) {
    errors.push("recoveryTimeout must be greater than 0");
  }

  if (config.circuitBreaker.halfOpenMaxCalls <= 0) {
    errors.push("halfOpenMaxCalls must be greater than 0");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
