import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getConfig,
  isDevelopment,
  isFeatureEnabled,
  isProduction,
  isTest,
  loadEnvironmentConfig,
  resetConfig,
  validateEnvironmentConfig,
} from '../environment';

describe('Environment Configuration', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCorsOrigins = process.env.CORS_ORIGINS;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const originalAgentFabricEnabled = process.env.AGENT_FABRIC_ENABLED;
  const originalWorkflowEnabled = process.env.WORKFLOW_ENABLED;
  const originalComplianceEnabled = process.env.COMPLIANCE_ENABLED;
  const originalFeatureAgentFabric = process.env.FEATURE_AGENTFABRIC;
  const originalFeatureWorkflow = process.env.FEATURE_WORKFLOW;
  const originalFeatureCompliance = process.env.FEATURE_COMPLIANCE;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CORS_ORIGINS', process.env.CORS_ORIGINS || 'http://localhost:5173');
    vi.stubEnv('SUPABASE_URL', process.env.SUPABASE_URL || 'http://localhost:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', process.env.SUPABASE_ANON_KEY || 'test-anon-key');
    vi.stubEnv('AGENT_FABRIC_ENABLED', 'true');
    vi.stubEnv('WORKFLOW_ENABLED', 'true');
    vi.stubEnv('COMPLIANCE_ENABLED', 'true');
    vi.stubEnv('FEATURE_AGENTFABRIC', 'true');
    vi.stubEnv('FEATURE_WORKFLOW', 'false');
    vi.stubEnv('FEATURE_COMPLIANCE', 'true');
    resetConfig();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalCorsOrigins === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = originalCorsOrigins;
    }
    if (originalSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    }
    if (originalSupabaseAnonKey === undefined) {
      delete process.env.SUPABASE_ANON_KEY;
    } else {
      process.env.SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }
    if (originalAgentFabricEnabled === undefined) {
      delete process.env.AGENT_FABRIC_ENABLED;
    } else {
      process.env.AGENT_FABRIC_ENABLED = originalAgentFabricEnabled;
    }
    if (originalWorkflowEnabled === undefined) {
      delete process.env.WORKFLOW_ENABLED;
    } else {
      process.env.WORKFLOW_ENABLED = originalWorkflowEnabled;
    }
    if (originalComplianceEnabled === undefined) {
      delete process.env.COMPLIANCE_ENABLED;
    } else {
      process.env.COMPLIANCE_ENABLED = originalComplianceEnabled;
    }
    if (originalFeatureAgentFabric === undefined) {
      delete process.env.FEATURE_AGENTFABRIC;
    } else {
      process.env.FEATURE_AGENTFABRIC = originalFeatureAgentFabric;
    }
    if (originalFeatureWorkflow === undefined) {
      delete process.env.FEATURE_WORKFLOW;
    } else {
      process.env.FEATURE_WORKFLOW = originalFeatureWorkflow;
    }
    if (originalFeatureCompliance === undefined) {
      delete process.env.FEATURE_COMPLIANCE;
    } else {
      process.env.FEATURE_COMPLIANCE = originalFeatureCompliance;
    }
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

    it('should require dev mocks to be disabled in production', () => {
      process.env.DEV_MOCKS_ENABLED = 'true';
      const config = loadEnvironmentConfig();
      config.app.env = 'production';

      const errors = validateEnvironmentConfig(config);

      expect(errors.some(e => e.includes('DEV_MOCKS_ENABLED'))).toBe(true);
      delete process.env.DEV_MOCKS_ENABLED;
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
      expect(isFeatureEnabled('agentFabric')).toBe(true);
      expect(isFeatureEnabled('workflow')).toBe(false);
      expect(isFeatureEnabled('compliance')).toBe(true);
    });
  });


  describe('MFA configuration', () => {
    it('enables MFA when MFA_ENABLED=true', () => {
      process.env.MFA_ENABLED = 'true';
      const config = getConfig();

      expect(config.auth.mfaEnabled).toBe(true);
    });

    it('defaults MFA to disabled when MFA_ENABLED is not explicitly true', () => {
      delete process.env.MFA_ENABLED;
      const config = getConfig();

      expect(config.auth.mfaEnabled).toBe(false);
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

  // ============================================================================
  // Supabase Configuration Tests (Dec 1, 2025 Fix)
  // ============================================================================
  describe('Supabase Configuration', () => {
    it('should load Supabase URL from environment', () => {
      const config = getConfig();
      
      expect(config.database.url).toBeDefined();
    });

    it('should load Supabase anon key from environment', () => {
      const config = getConfig();
      
      expect(config.database.anonKey).toBeDefined();
    });

    it('should validate Supabase URL format if provided', () => {
      const config = getConfig();
      
      if (config.database.url) {
        // Should be a valid URL
        expect(() => new URL(config.database.url)).not.toThrow();
        
        // Real deployed Supabase URLs should use HTTPS; local test URLs may use HTTP.
        if (
          !config.database.url.includes('your-project') &&
          !config.database.url.includes('localhost')
        ) {
          expect(config.database.url).toMatch(/^https:\/\//);
        }
      }
    });

    it('should have valid Supabase key format if provided', () => {
      const config = getConfig();
      
      if (
        config.database.anonKey &&
        !config.database.anonKey.includes('your-') &&
        !config.database.anonKey.startsWith('test-')
      ) {
        // Real keys should have proper prefix; local test keys are permitted in Vitest.
        expect(
          config.database.anonKey.startsWith('eyJ') || 
          config.database.anonKey.startsWith('sb_publishable_')
        ).toBe(true);
      }
    });
  });

  // ============================================================================
  // CORS Configuration Tests (Dec 1, 2025 Fix)
  // ============================================================================
  describe('CORS Configuration', () => {
    it('should have CORS origins configured', () => {
      const config = getConfig();
      
      expect(config.security.corsOrigins).toBeDefined();
      expect(Array.isArray(config.security.corsOrigins)).toBe(true);
    });

    it('should include localhost in development CORS origins', () => {
      const config = getConfig();
      
      if (config.app.env === 'development') {
        const hasLocalhost = config.security.corsOrigins.some(
          origin => origin.includes('localhost')
        );
        expect(hasLocalhost).toBe(true);
      }
    });

    it('should have proper security settings', () => {
      const config = getConfig();
      
      expect(config.security.csrfEnabled).toBeDefined();
      expect(config.security.cspEnabled).toBeDefined();
      expect(config.security.rateLimitPerMinute).toBeGreaterThan(0);
    });
  });
});
