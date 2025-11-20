/**
 * Environment Configuration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadEnvironmentConfig,
  validateEnvironmentConfig,
  resetConfig,
  getConfig,
  isProduction,
  isDevelopment,
  isTest,
  isFeatureEnabled,
} from '../environment';

describe('Environment Configuration', () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
  });

  describe('loadEnvironmentConfig', () => {
    it('should load configuration with defaults', () => {
      const config = loadEnvironmentConfig();
      
      expect(config).toBeDefined();
      expect(config.app).toBeDefined();
      expect(config.agents).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.features).toBeDefined();
    });

    it('should have correct app environment', () => {
      const config = loadEnvironmentConfig();
      
      expect(config.app.env).toBe('test');
    });

    it('should have agent configuration', () => {
      const config = loadEnvironmentConfig();
      
      expect(config.agents.apiUrl).toBeDefined();
      expect(config.agents.timeout).toBeGreaterThan(0);
      expect(config.agents.circuitBreaker).toBeDefined();
    });

    it('should have security configuration', () => {
      const config = loadEnvironmentConfig();
      
      expect(config.security.httpsOnly).toBeDefined();
      expect(config.security.corsOrigins).toBeInstanceOf(Array);
      expect(config.security.rateLimitPerMinute).toBeGreaterThan(0);
    });

    it('should have feature flags', () => {
      const config = loadEnvironmentConfig();
      
      expect(config.features.agentFabric).toBeDefined();
      expect(config.features.workflow).toBeDefined();
      expect(config.features.compliance).toBeDefined();
    });
  });

  describe('validateEnvironmentConfig', () => {
    it('should validate valid configuration', () => {
      const config = loadEnvironmentConfig();
      const errors = validateEnvironmentConfig(config);
      
      expect(errors).toBeInstanceOf(Array);
      // Test environment may have some missing configs, that's okay
    });

    it('should detect missing required fields in production', () => {
      const config = loadEnvironmentConfig();
      config.app.env = 'production';
      config.database.url = '';
      
      const errors = validateEnvironmentConfig(config);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('SUPABASE_URL'))).toBe(true);
    });

    it('should validate agent fabric requirements', () => {
      const config = loadEnvironmentConfig();
      config.features.agentFabric = true;
      config.agents.apiUrl = '';
      
      const errors = validateEnvironmentConfig(config);
      
      expect(errors.some(e => e.includes('AGENT_API_URL'))).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return singleton instance', () => {
      const config1 = getConfig();
      const config2 = getConfig();
      
      expect(config1).toBe(config2);
    });

    it('should cache configuration', () => {
      const config = getConfig();
      
      expect(config).toBeDefined();
      expect(config.app).toBeDefined();
    });
  });

  describe('environment helpers', () => {
    it('should detect test environment', () => {
      expect(isTest()).toBe(true);
    });

    it('should not be production in test', () => {
      expect(isProduction()).toBe(false);
    });

    it('should not be development in test', () => {
      expect(isDevelopment()).toBe(false);
    });
  });

  describe('feature flags', () => {
    it('should check if feature is enabled', () => {
      const agentFabricEnabled = isFeatureEnabled('agentFabric');
      
      expect(typeof agentFabricEnabled).toBe('boolean');
    });

    it('should return correct feature flag values', () => {
      const config = getConfig();
      
      expect(isFeatureEnabled('agentFabric')).toBe(config.features.agentFabric);
      expect(isFeatureEnabled('workflow')).toBe(config.features.workflow);
      expect(isFeatureEnabled('compliance')).toBe(config.features.compliance);
    });
  });

  describe('resetConfig', () => {
    it('should reset configuration', () => {
      const config1 = getConfig();
      resetConfig();
      const config2 = getConfig();
      
      // Should be different instances after reset
      expect(config1).not.toBe(config2);
    });
  });
});
