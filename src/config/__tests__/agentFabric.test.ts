/**
 * AgentFabric Configuration Tests
 * Tests the centralized configuration for agent safety limits and operational parameters
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AgentFabricConfig,
  DEFAULT_AGENT_FABRIC_CONFIG,
  getEnvironmentConfig,
  loadAgentFabricConfig,
  validateAgentFabricConfig,
} from '../../config/agentFabric';

// Mock process.env
const originalEnv = process.env;

describe('AgentFabric Configuration', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Default Configuration', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_AGENT_FABRIC_CONFIG.safetyLimits.maxExecutionTime).toBe(30000);
      expect(DEFAULT_AGENT_FABRIC_CONFIG.safetyLimits.maxLLMCalls).toBe(20);
      expect(DEFAULT_AGENT_FABRIC_CONFIG.safetyLimits.maxRecursionDepth).toBe(5);
      expect(DEFAULT_AGENT_FABRIC_CONFIG.safetyLimits.maxMemoryBytes).toBe(100 * 1024 * 1024); // 100MB
      expect(DEFAULT_AGENT_FABRIC_CONFIG.safetyLimits.maxExecutionCost).toBe(5.00);
      expect(DEFAULT_AGENT_FABRIC_CONFIG.safetyLimits.maxHourlyCost).toBe(10.00);
      expect(DEFAULT_AGENT_FABRIC_CONFIG.safetyLimits.costCheckIntervalMs).toBe(5000);
    });

    it('should have proper LLM gateway defaults', () => {
      expect(DEFAULT_AGENT_FABRIC_CONFIG.llmGateway.defaultModel).toBe('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo');
      expect(DEFAULT_AGENT_FABRIC_CONFIG.llmGateway.lowCostModel).toBe('microsoft/phi-4-mini');
      expect(DEFAULT_AGENT_FABRIC_CONFIG.llmGateway.gatingEnabled).toBe(true);
    });

    it('should have proper memory configuration', () => {
      expect(DEFAULT_AGENT_FABRIC_CONFIG.memory.defaultEpisodicTTL).toBe(86400); // 24 hours
      expect(DEFAULT_AGENT_FABRIC_CONFIG.memory.defaultSemanticTTL).toBe(604800); // 7 days
      expect(DEFAULT_AGENT_FABRIC_CONFIG.memory.maxTenantMemoryBytes).toBe(1024 * 1024 * 1024); // 1GB
    });

    it('should have proper audit configuration', () => {
      expect(DEFAULT_AGENT_FABRIC_CONFIG.audit.enabled).toBe(true);
      expect(DEFAULT_AGENT_FABRIC_CONFIG.audit.retentionDays).toBe(90);
      expect(DEFAULT_AGENT_FABRIC_CONFIG.audit.batchSize).toBe(100);
    });

    it('should have proper cost tracking configuration', () => {
      expect(DEFAULT_AGENT_FABRIC_CONFIG.costTracking.enabled).toBe(true);
      expect(DEFAULT_AGENT_FABRIC_CONFIG.costTracking.alertThresholds.perExecution).toBe(2.50);
      expect(DEFAULT_AGENT_FABRIC_CONFIG.costTracking.alertThresholds.hourly).toBe(5.00);
      expect(DEFAULT_AGENT_FABRIC_CONFIG.costTracking.precision).toBe(4);
    });
  });

  describe('Environment Variable Overrides', () => {
    it('should override safety limits from environment', () => {
      process.env.AGENT_MAX_EXECUTION_TIME_MS = '60000';
      process.env.AGENT_MAX_LLM_CALLS = '50';
      process.env.AGENT_MAX_EXECUTION_COST = '10.00';
      process.env.AGENT_MAX_HOURLY_COST = '20.00';

      const config = loadAgentFabricConfig();

      expect(config.safetyLimits.maxExecutionTime).toBe(60000);
      expect(config.safetyLimits.maxLLMCalls).toBe(50);
      expect(config.safetyLimits.maxExecutionCost).toBe(10.00);
      expect(config.safetyLimits.maxHourlyCost).toBe(20.00);
    });

    it('should override LLM gateway settings from environment', () => {
      process.env.LLM_DEFAULT_MODEL = 'gpt-4-turbo';
      process.env.LLM_LOW_COST_MODEL = 'gpt-3.5-turbo';
      process.env.LLM_GATING_ENABLED = 'false';

      const config = loadAgentFabricConfig();

      expect(config.llmGateway.defaultModel).toBe('gpt-4-turbo');
      expect(config.llmGateway.lowCostModel).toBe('gpt-3.5-turbo');
      expect(config.llmGateway.gatingEnabled).toBe(false);
    });

    it('should override provider settings from environment', () => {
      process.env.TOGETHER_API_BASE_URL = 'https://custom-together.example.com';
      process.env.TOGETHER_TIMEOUT_MS = '45000';
      process.env.OPENAI_API_BASE_URL = 'https://custom-openai.example.com';

      const config = loadAgentFabricConfig();

      expect(config.llmGateway.providers.together.baseUrl).toBe('https://custom-together.example.com');
      expect(config.llmGateway.providers.together.timeout).toBe(45000);
      expect(config.llmGateway.providers.openai.baseUrl).toBe('https://custom-openai.example.com');
    });

    it('should override memory settings from environment', () => {
      process.env.MEMORY_EPISODIC_TTL_SECONDS = '7200'; // 2 hours
      process.env.MEMORY_SEMANTIC_TTL_SECONDS = '2592000'; // 30 days
      process.env.MEMORY_MAX_TENANT_BYTES = '2147483648'; // 2GB

      const config = loadAgentFabricConfig();

      expect(config.memory.defaultEpisodicTTL).toBe(7200);
      expect(config.memory.defaultSemanticTTL).toBe(2592000);
      expect(config.memory.maxTenantMemoryBytes).toBe(2147483648);
    });

    it('should override audit settings from environment', () => {
      process.env.AUDIT_LOGGING_ENABLED = 'false';
      process.env.AUDIT_RETENTION_DAYS = '365';
      process.env.AUDIT_BATCH_SIZE = '500';

      const config = loadAgentFabricConfig();

      expect(config.audit.enabled).toBe(false);
      expect(config.audit.retentionDays).toBe(365);
      expect(config.audit.batchSize).toBe(500);
    });

    it('should override cost tracking settings from environment', () => {
      process.env.COST_TRACKING_ENABLED = 'false';
      process.env.COST_ALERT_EXECUTION_THRESHOLD = '5.00';
      process.env.COST_PRECISION = '2';

      const config = loadAgentFabricConfig();

      expect(config.costTracking.enabled).toBe(false);
      expect(config.costTracking.alertThresholds.perExecution).toBe(5.00);
      expect(config.costTracking.precision).toBe(2);
    });

    it('should handle boolean environment variables', () => {
      process.env.AGENT_DETAILED_TRACKING = 'true';
      process.env.LLM_GATING_ENABLED = 'false';
      process.env.AUDIT_LOGGING_ENABLED = 'true';
      process.env.COST_TRACKING_ENABLED = 'false';

      const config = loadAgentFabricConfig();

      expect(config.safetyLimits.enableDetailedTracking).toBe(true);
      expect(config.llmGateway.gatingEnabled).toBe(false);
      expect(config.audit.enabled).toBe(true);
      expect(config.costTracking.enabled).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate correct configuration', () => {
      const validConfig: AgentFabricConfig = {
        ...DEFAULT_AGENT_FABRIC_CONFIG,
      };

      const result = validateAgentFabricConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid safety limits', () => {
      const invalidConfig: AgentFabricConfig = {
        ...DEFAULT_AGENT_FABRIC_CONFIG,
        safetyLimits: {
          ...DEFAULT_AGENT_FABRIC_CONFIG.safetyLimits,
          maxExecutionTime: -100, // Invalid negative value
          maxLLMCalls: 0, // Invalid zero value
          maxExecutionCost: -5.00, // Invalid negative cost
        },
      };

      const result = validateAgentFabricConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxExecutionTime must be positive');
      expect(result.errors).toContain('maxLLMCalls must be positive');
      expect(result.errors).toContain('maxExecutionCost cannot be negative');
    });

    it('should validate URL formats', () => {
      const invalidConfig: AgentFabricConfig = {
        ...DEFAULT_AGENT_FABRIC_CONFIG,
        llmGateway: {
          ...DEFAULT_AGENT_FABRIC_CONFIG.llmGateway,
          providers: {
            together: {
              baseUrl: 'not-a-valid-url',
              timeout: 30000,
            },
            openai: {
              baseUrl: 'https://valid-url.com',
              timeout: 30000,
            },
          },
        },
      };

      const result = validateAgentFabricConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid together baseUrl');
    });
  });

  describe('Environment-Specific Configuration', () => {
    it('should provide development overrides', () => {
      const devConfig = getEnvironmentConfig('development');

      expect(devConfig.safetyLimits?.maxExecutionTime).toBe(60000);
      expect(devConfig.safetyLimits?.maxLLMCalls).toBe(50);
      expect(devConfig.audit?.enabled).toBe(false);
    });

    it('should provide staging overrides', () => {
      const stagingConfig = getEnvironmentConfig('staging');

      expect(stagingConfig.safetyLimits?.maxExecutionTime).toBe(45000);
      expect(stagingConfig.safetyLimits?.maxExecutionCost).toBe(7.50);
    });

    it('should provide production overrides', () => {
      const prodConfig = getEnvironmentConfig('production');

      expect(prodConfig.safetyLimits?.maxExecutionTime).toBe(30000);
      expect(prodConfig.safetyLimits?.maxExecutionCost).toBe(5.00);
      expect(prodConfig.audit?.enabled).toBe(true);
    });

    it('should return empty config for unknown environment', () => {
      const unknownConfig = getEnvironmentConfig('unknown' as any);

      expect(unknownConfig).toEqual({});
    });
  });

  describe('Configuration Loading', () => {
    it('should load configuration with environment overrides', () => {
      process.env.AGENT_MAX_EXECUTION_TIME_MS = '45000';
      process.env.LLM_DEFAULT_MODEL = 'custom-model';

      const config = loadAgentFabricConfig();

      expect(config.safetyLimits.maxExecutionTime).toBe(45000);
      expect(config.llmGateway.defaultModel).toBe('custom-model');
    });

    it('should merge environment overrides with defaults', () => {
      process.env.AGENT_MAX_LLM_CALLS = '100';

      const config = loadAgentFabricConfig();

      expect(config.safetyLimits.maxLLMCalls).toBe(100);
      // Other defaults should remain
      expect(config.safetyLimits.maxExecutionTime).toBe(30000);
      expect(config.llmGateway.gatingEnabled).toBe(true);
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for configuration object', () => {
      const config = loadAgentFabricConfig();

      // TypeScript should catch these errors at compile time
      expect(typeof config.safetyLimits.maxExecutionTime).toBe('number');
      expect(typeof config.llmGateway.gatingEnabled).toBe('boolean');
      expect(typeof config.memory.defaultEpisodicTTL).toBe('number');
      expect(typeof config.audit.enabled).toBe('boolean');
      expect(typeof config.costTracking.precision).toBe('number');
    });
  });
});
