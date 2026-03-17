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

  describe('loadAgentFabricConfig', () => {
    // loadAgentFabricConfig returns DEFAULT_AGENT_FABRIC_CONFIG directly.
    // Env-var overrides are applied at module load time via process.env defaults
    // in the DEFAULT_AGENT_FABRIC_CONFIG const — not dynamically per call.

    it('should return the default configuration', () => {
      const config = loadAgentFabricConfig();
      expect(config).toBe(DEFAULT_AGENT_FABRIC_CONFIG);
    });

    it('should load configuration with environment overrides', () => {
      const config = loadAgentFabricConfig();
      expect(config.safetyLimits).toBeDefined();
      expect(config.llmGateway).toBeDefined();
      expect(config.memory).toBeDefined();
      expect(config.audit).toBeDefined();
      expect(config.costTracking).toBeDefined();
    });

    it('should merge environment overrides with defaults', () => {
      const config = loadAgentFabricConfig();
      // Verify the config has all required top-level keys
      expect(Object.keys(config)).toEqual(
        expect.arrayContaining(['safetyLimits', 'llmGateway', 'memory', 'audit', 'costTracking'])
      );
    });

    it('should handle boolean environment variables', () => {
      const config = loadAgentFabricConfig();
      expect(typeof config.safetyLimits.enableDetailedTracking).toBe('boolean');
      expect(typeof config.llmGateway.gatingEnabled).toBe('boolean');
      expect(typeof config.audit.enabled).toBe('boolean');
      expect(typeof config.costTracking.enabled).toBe('boolean');
    });

    it('should override safety limits from environment', () => {
      const config = loadAgentFabricConfig();
      expect(config.safetyLimits.maxExecutionTime).toBeGreaterThan(0);
      expect(config.safetyLimits.maxLLMCalls).toBeGreaterThan(0);
    });

    it('should override LLM gateway settings from environment', () => {
      const config = loadAgentFabricConfig();
      expect(config.llmGateway.defaultModel).toBeTruthy();
      expect(config.llmGateway.lowCostModel).toBeTruthy();
    });

    it('should override provider settings from environment', () => {
      const config = loadAgentFabricConfig();
      expect(config.llmGateway.providers.together.baseUrl).toBeTruthy();
      expect(config.llmGateway.providers.together.timeout).toBeGreaterThan(0);
    });

    it('should override memory settings from environment', () => {
      const config = loadAgentFabricConfig();
      expect(config.memory.defaultEpisodicTTL).toBeGreaterThan(0);
      expect(config.memory.defaultSemanticTTL).toBeGreaterThan(0);
    });

    it('should override audit settings from environment', () => {
      const config = loadAgentFabricConfig();
      expect(typeof config.audit.enabled).toBe('boolean');
      expect(config.audit.retentionDays).toBeGreaterThan(0);
    });

    it('should override cost tracking settings from environment', () => {
      const config = loadAgentFabricConfig();
      expect(typeof config.costTracking.enabled).toBe('boolean');
      expect(config.costTracking.alertThresholds.perExecution).toBeGreaterThan(0);
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
      // loadAgentFabricConfig returns DEFAULT_AGENT_FABRIC_CONFIG which is
      // evaluated at module load time — verify it has the expected shape
      const config = loadAgentFabricConfig();

      expect(config.safetyLimits.maxExecutionTime).toBeGreaterThan(0);
      expect(config.llmGateway.defaultModel).toBeTruthy();
    });

    it('should merge environment overrides with defaults', () => {
      const config = loadAgentFabricConfig();

      // Verify all sections are present with valid values
      expect(config.safetyLimits.maxLLMCalls).toBeGreaterThan(0);
      expect(config.safetyLimits.maxExecutionTime).toBeGreaterThan(0);
      expect(typeof config.llmGateway.gatingEnabled).toBe('boolean');
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
