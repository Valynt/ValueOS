/**
 * Agent Fabric Configuration
 * Centralized configuration for agent safety limits, costs, and operational parameters
 */

import { SafetyLimits } from '../lib/agent-fabric/CircuitBreaker';
import { getEnvVar } from '../lib/env';

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
    maxExecutionTime: parseInt(getEnvVar('AGENT_MAX_EXECUTION_TIME_MS', { defaultValue: '30000' }) || '30000'), // 30 seconds
    maxLLMCalls: parseInt(getEnvVar('AGENT_MAX_LLM_CALLS', { defaultValue: '20' }) || '20'),
    maxRecursionDepth: parseInt(getEnvVar('AGENT_MAX_RECURSION_DEPTH', { defaultValue: '5' }) || '5'),
    maxMemoryBytes: parseInt(getEnvVar('AGENT_MAX_MEMORY_BYTES', { defaultValue: String(100 * 1024 * 1024) }) || String(100 * 1024 * 1024)), // 100MB
    enableDetailedTracking: getEnvVar('AGENT_DETAILED_TRACKING') === 'true',
    maxExecutionCost: parseFloat(getEnvVar('AGENT_MAX_EXECUTION_COST', { defaultValue: '5.00' }) || '5.00'), // $5.00
    maxHourlyCost: parseFloat(getEnvVar('AGENT_MAX_HOURLY_COST', { defaultValue: '10.00' }) || '10.00'), // $10.00
    costCheckIntervalMs: parseInt(getEnvVar('AGENT_COST_CHECK_INTERVAL_MS', { defaultValue: '5000' }) || '5000'), // 5 seconds
  },

  llmGateway: {
    defaultModel: getEnvVar('LLM_DEFAULT_MODEL', { defaultValue: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' }) || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    lowCostModel: getEnvVar('LLM_LOW_COST_MODEL', { defaultValue: 'microsoft/phi-4-mini' }) || 'microsoft/phi-4-mini',
    highCostModel: getEnvVar('LLM_HIGH_COST_MODEL', { defaultValue: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' }) || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',

    gatingEnabled: getEnvVar('LLM_GATING_ENABLED', { defaultValue: 'true' }) !== 'false',

    providers: {
      together: {
        baseUrl: getEnvVar('TOGETHER_API_BASE_URL', { defaultValue: 'https://api.together.xyz/v1' }) || 'https://api.together.xyz/v1',
        timeout: parseInt(getEnvVar('TOGETHER_TIMEOUT_MS', { defaultValue: '30000' }) || '30000'),
      },
      openai: {
        baseUrl: getEnvVar('OPENAI_API_BASE_URL', { defaultValue: 'https://api.openai.com/v1' }) || 'https://api.openai.com/v1',
        timeout: parseInt(getEnvVar('OPENAI_TIMEOUT_MS', { defaultValue: '30000' }) || '30000'),
      },
    },
  },

  memory: {
    defaultEpisodicTTL: parseInt(getEnvVar('MEMORY_EPISODIC_TTL_SECONDS', { defaultValue: '86400' }) || '86400'), // 24 hours
    defaultSemanticTTL: parseInt(getEnvVar('MEMORY_SEMANTIC_TTL_SECONDS', { defaultValue: '604800' }) || '604800'), // 7 days
    maxTenantMemoryBytes: parseInt(getEnvVar('MEMORY_MAX_TENANT_BYTES', { defaultValue: String(1024 * 1024 * 1024) }) || String(1024 * 1024 * 1024)), // 1GB
    cleanupIntervalSeconds: parseInt(getEnvVar('MEMORY_CLEANUP_INTERVAL_SECONDS', { defaultValue: '3600' }) || '3600'), // 1 hour
  },

  audit: {
    enabled: getEnvVar('AUDIT_LOGGING_ENABLED', { defaultValue: 'true' }) !== 'false',
    retentionDays: parseInt(getEnvVar('AUDIT_RETENTION_DAYS', { defaultValue: '90' }) || '90'),
    batchSize: parseInt(getEnvVar('AUDIT_BATCH_SIZE', { defaultValue: '100' }) || '100'),
  },

  costTracking: {
    enabled: getEnvVar('COST_TRACKING_ENABLED', { defaultValue: 'true' }) !== 'false',
    alertThresholds: {
      perExecution: parseFloat(getEnvVar('COST_ALERT_EXECUTION_THRESHOLD', { defaultValue: '2.50' }) || '2.50'),
      hourly: parseFloat(getEnvVar('COST_ALERT_HOURLY_THRESHOLD', { defaultValue: '5.00' }) || '5.00'),
      daily: parseFloat(getEnvVar('COST_ALERT_DAILY_THRESHOLD', { defaultValue: '50.00' }) || '50.00'),
    },
    precision: parseInt(getEnvVar('COST_PRECISION', { defaultValue: '4' }) || '4'),
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
