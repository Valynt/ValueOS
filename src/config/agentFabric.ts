/**
 * Agent Fabric Configuration
 * Centralized configuration for agent safety limits, costs, and operational parameters
 */

import { SafetyLimits } from '../lib/agent-fabric/CircuitBreaker';

export interface AgentFabricConfig {
  /** Circuit breaker safety limits */
  safetyLimits: SafetyLimits;

  /** LLM Gateway configuration */
  llmGateway: {
    /** Default model configurations */
    defaultModel: string;
    lowCostModel: string;
    highCostModel: string;

    /** Gating configuration */
    gatingEnabled: boolean;

    /** Provider configurations */
    providers: {
      together: {
        baseUrl: string;
        timeout: number;
      };
      openai: {
        baseUrl: string;
        timeout: number;
      };
    };
  };

  /** Memory system configuration */
  memory: {
    /** Default TTL for episodic memories (seconds) */
    defaultEpisodicTTL: number;
    /** Default TTL for semantic memories (seconds) */
    defaultSemanticTTL: number;
    /** Maximum memory size per tenant (bytes) */
    maxTenantMemoryBytes: number;
    /** Memory cleanup interval (seconds) */
    cleanupIntervalSeconds: number;
  };

  /** Audit logging configuration */
  audit: {
    /** Enable audit logging */
    enabled: boolean;
    /** Maximum audit log retention (days) */
    retentionDays: number;
    /** Batch size for bulk audit operations */
    batchSize: number;
  };

  /** Cost tracking configuration */
  costTracking: {
    /** Enable cost tracking */
    enabled: boolean;
    /** Cost alert thresholds */
    alertThresholds: {
      perExecution: number;
      hourly: number;
      daily: number;
    };
    /** Cost tracking precision (decimal places) */
    precision: number;
  };
}

/**
 * Default configuration values
 * These can be overridden by environment variables or config files
 */
export const DEFAULT_AGENT_FABRIC_CONFIG: AgentFabricConfig = {
  safetyLimits: {
    maxExecutionTime: parseInt(process.env.AGENT_MAX_EXECUTION_TIME_MS || '30000'), // 30 seconds
    maxLLMCalls: parseInt(process.env.AGENT_MAX_LLM_CALLS || '20'),
    maxRecursionDepth: parseInt(process.env.AGENT_MAX_RECURSION_DEPTH || '5'),
    maxMemoryBytes: parseInt(process.env.AGENT_MAX_MEMORY_BYTES || String(100 * 1024 * 1024)), // 100MB
    enableDetailedTracking: process.env.AGENT_DETAILED_TRACKING === 'true',
    maxExecutionCost: parseFloat(process.env.AGENT_MAX_EXECUTION_COST || '5.00'), // $5.00
    maxHourlyCost: parseFloat(process.env.AGENT_MAX_HOURLY_COST || '10.00'), // $10.00
    costCheckIntervalMs: parseInt(process.env.AGENT_COST_CHECK_INTERVAL_MS || '5000'), // 5 seconds
  },

  llmGateway: {
    defaultModel: process.env.LLM_DEFAULT_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    lowCostModel: process.env.LLM_LOW_COST_MODEL || 'microsoft/phi-4-mini',
    highCostModel: process.env.LLM_HIGH_COST_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',

    gatingEnabled: process.env.LLM_GATING_ENABLED !== 'false',

    providers: {
      together: {
        baseUrl: process.env.TOGETHER_API_BASE_URL || 'https://api.together.xyz/v1',
        timeout: parseInt(process.env.TOGETHER_TIMEOUT_MS || '30000'),
      },
      openai: {
        baseUrl: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
        timeout: parseInt(process.env.OPENAI_TIMEOUT_MS || '30000'),
      },
    },
  },

  memory: {
    defaultEpisodicTTL: parseInt(process.env.MEMORY_EPISODIC_TTL_SECONDS || '86400'), // 24 hours
    defaultSemanticTTL: parseInt(process.env.MEMORY_SEMANTIC_TTL_SECONDS || '604800'), // 7 days
    maxTenantMemoryBytes: parseInt(process.env.MEMORY_MAX_TENANT_BYTES || String(1024 * 1024 * 1024)), // 1GB
    cleanupIntervalSeconds: parseInt(process.env.MEMORY_CLEANUP_INTERVAL_SECONDS || '3600'), // 1 hour
  },

  audit: {
    enabled: process.env.AUDIT_LOGGING_ENABLED !== 'false',
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '90'),
    batchSize: parseInt(process.env.AUDIT_BATCH_SIZE || '100'),
  },

  costTracking: {
    enabled: process.env.COST_TRACKING_ENABLED !== 'false',
    alertThresholds: {
      perExecution: parseFloat(process.env.COST_ALERT_EXECUTION_THRESHOLD || '2.50'),
      hourly: parseFloat(process.env.COST_ALERT_HOURLY_THRESHOLD || '5.00'),
      daily: parseFloat(process.env.COST_ALERT_DAILY_THRESHOLD || '50.00'),
    },
    precision: parseInt(process.env.COST_PRECISION || '4'),
  },
};

/**
 * Load configuration with environment variable overrides
 */
export function loadAgentFabricConfig(): AgentFabricConfig {
  return DEFAULT_AGENT_FABRIC_CONFIG;
}

/**
 * Validate configuration values
 */
export function validateAgentFabricConfig(config: AgentFabricConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate safety limits
  if (config.safetyLimits.maxExecutionTime <= 0) {
    errors.push('maxExecutionTime must be positive');
  }
  if (config.safetyLimits.maxLLMCalls <= 0) {
    errors.push('maxLLMCalls must be positive');
  }
  if (config.safetyLimits.maxRecursionDepth <= 0) {
    errors.push('maxRecursionDepth must be positive');
  }
  if (config.safetyLimits.maxMemoryBytes <= 0) {
    errors.push('maxMemoryBytes must be positive');
  }
  if (config.safetyLimits.maxExecutionCost < 0) {
    errors.push('maxExecutionCost cannot be negative');
  }
  if (config.safetyLimits.maxHourlyCost < 0) {
    errors.push('maxHourlyCost cannot be negative');
  }
  if (config.safetyLimits.costCheckIntervalMs <= 0) {
    errors.push('costCheckIntervalMs must be positive');
  }

  // Validate URLs
  try {
    new URL(config.llmGateway.providers.together.baseUrl);
  } catch {
    errors.push('Invalid together baseUrl');
  }

  try {
    new URL(config.llmGateway.providers.openai.baseUrl);
  } catch {
    errors.push('Invalid openai baseUrl');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get configuration for a specific environment
 */
export function getEnvironmentConfig(environment: 'development' | 'staging' | 'production'): Partial<AgentFabricConfig> {
  switch (environment) {
    case 'development':
      return {
        safetyLimits: {
          maxExecutionTime: 60000, // 1 minute for development
          maxLLMCalls: 50, // More calls for testing
          maxRecursionDepth: 5,
          maxMemoryBytes: 100 * 1024 * 1024,
          enableDetailedTracking: false,
          maxExecutionCost: 10.00, // Higher cost limit for testing
          maxHourlyCost: 10.00,
          costCheckIntervalMs: 5000,
        },
        audit: {
          enabled: false, // Disable audit logging in development
          retentionDays: 90,
          batchSize: 100,
        },
      };

    case 'staging':
      return {
        safetyLimits: {
          maxExecutionTime: 45000, // 45 seconds
          maxLLMCalls: 20,
          maxRecursionDepth: 5,
          maxMemoryBytes: 100 * 1024 * 1024,
          enableDetailedTracking: false,
          maxExecutionCost: 7.50, // $7.50 per execution
          maxHourlyCost: 10.00,
          costCheckIntervalMs: 5000,
        },
      };

    case 'production':
      return {
        safetyLimits: {
          maxExecutionTime: 30000, // 30 seconds (stricter)
          maxLLMCalls: 20,
          maxRecursionDepth: 5,
          maxMemoryBytes: 100 * 1024 * 1024,
          enableDetailedTracking: false,
          maxExecutionCost: 5.00, // $5.00 per execution (stricter)
          maxHourlyCost: 10.00,
          costCheckIntervalMs: 5000,
        },
        audit: {
          enabled: true, // Always enable in production
          retentionDays: 90,
          batchSize: 100,
        },
      };

    default:
      return {};
  }
}
