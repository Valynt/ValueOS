import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateRequiredEnv,
  validateEnv,
  getEnvVar,
  setEnvVar,
  getSupabaseConfig,
  getSupabaseServerConfig,
  getGroundtruthConfig,
  getLLMCostTrackerConfig,
  checkIsBrowser,
  env,
  REQUIRED_ENV_VARS,
} from './env';

describe('env validation', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleWarnSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('validateRequiredEnv', () => {
    it('should not throw when all required environment variables are present', () => {
      for (const key of REQUIRED_ENV_VARS) {
        process.env[key] = `test_value_for_${key}`;
      }
      expect(() => validateRequiredEnv()).not.toThrow();
    });

    it('should throw an error when required environment variables are missing', () => {
      for (const key of REQUIRED_ENV_VARS) {
        delete process.env[key];
      }
      expect(() => validateRequiredEnv()).toThrowError(
        `Missing required environment variables:\n${REQUIRED_ENV_VARS.join('\n')}`
      );
    });

    it('should throw an error with specific missing variables', () => {
      const missingVars = [REQUIRED_ENV_VARS[0], REQUIRED_ENV_VARS[1]];
      for (const key of REQUIRED_ENV_VARS) {
        if (missingVars.includes(key)) {
          delete process.env[key];
        } else {
          process.env[key] = `test_value_for_${key}`;
        }
      }
      expect(() => validateRequiredEnv()).toThrowError(
        `Missing required environment variables:\n${missingVars.join('\n')}`
      );
    });
  });

  describe('validateEnv', () => {
    it('should call validateRequiredEnv', () => {
      for (const key of REQUIRED_ENV_VARS) {
        delete process.env[key];
      }
      expect(() => validateEnv()).toThrowError();
    });
  });

  describe('getEnvVar', () => {
    it('should return the environment variable if it exists', () => {
      process.env['TEST_VAR'] = 'test_value';
      expect(getEnvVar('TEST_VAR')).toBe('test_value');
    });

    it('should return undefined if the environment variable does not exist and no default is provided', () => {
      delete process.env['TEST_VAR'];
      expect(getEnvVar('TEST_VAR')).toBeUndefined();
    });

    it('should return the default value if the environment variable does not exist', () => {
      delete process.env['TEST_VAR'];
      expect(getEnvVar('TEST_VAR', { defaultValue: 'default_value' })).toBe('default_value');
    });

    it('should throw an error if the environment variable does not exist and is required', () => {
      delete process.env['TEST_VAR'];
      expect(() => getEnvVar('TEST_VAR', { required: true })).toThrowError(/Missing required server environment variable: TEST_VAR/);
    });

    it('should return the value even if a default is provided', () => {
      process.env['TEST_VAR'] = 'test_value';
      expect(getEnvVar('TEST_VAR', { defaultValue: 'default_value' })).toBe('test_value');
    });
  });

  describe('setEnvVar', () => {
    it('should set an environment variable', () => {
      setEnvVar('TEST_SET_VAR', 'new_value');
      expect(process.env['TEST_SET_VAR']).toBe('new_value');
    });
  });

  describe('getSupabaseConfig', () => {
    it('should return config with correct values from env variables', () => {
      process.env['VITE_SUPABASE_URL'] = 'https://supabase.url';
      process.env['VITE_SUPABASE_ANON_KEY'] = 'anon_key';
      process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service_role_key';

      const config = getSupabaseConfig();
      expect(config).toEqual({
        url: 'https://supabase.url',
        anonKey: 'anon_key',
        serviceRoleKey: 'service_role_key',
      });
    });

    it('should fallback to other variable names', () => {
      delete process.env['VITE_SUPABASE_URL'];
      delete process.env['VITE_SUPABASE_ANON_KEY'];
      delete process.env['SUPABASE_SERVICE_ROLE_KEY'];

      process.env['SUPABASE_URL'] = 'https://supabase.url.fallback';
      process.env['SUPABASE_ANON_KEY'] = 'anon_key_fallback';
      process.env['SUPABASE_SERVICE_KEY'] = 'service_key_fallback';

      const config = getSupabaseConfig();
      expect(config).toEqual({
        url: 'https://supabase.url.fallback',
        anonKey: 'anon_key_fallback',
        serviceRoleKey: 'service_key_fallback',
      });
    });
  });

  describe('getSupabaseServerConfig', () => {
    it('should return server config', () => {
      process.env['VITE_SUPABASE_URL'] = 'https://supabase.url.server';
      process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service_role_key_server';

      const config = getSupabaseServerConfig();
      expect(config).toEqual({
        url: 'https://supabase.url.server',
        serviceRoleKey: 'service_role_key_server',
      });
    });
  });

  describe('getGroundtruthConfig', () => {
    it('should return groundtruth config', () => {
      process.env['VITE_GROUNDTRUTH_URL'] = 'https://groundtruth.url';
      process.env['VITE_GROUNDTRUTH_API_KEY'] = 'groundtruth_api_key';
      process.env['GROUNDTRUTH_TIMEOUT'] = '10000';

      const config = getGroundtruthConfig();
      expect(config).toEqual({
        baseUrl: 'https://groundtruth.url',
        apiKey: 'groundtruth_api_key',
        timeout: 10000,
      });
    });
  });

  describe('getLLMCostTrackerConfig', () => {
    it('should return llm cost tracker config', () => {
      process.env['VITE_SUPABASE_URL'] = 'https://supabase.url';
      process.env['VITE_SUPABASE_ANON_KEY'] = 'anon_key';
      process.env['LLM_COST_TABLE_NAME'] = 'custom_table';

      const config = getLLMCostTrackerConfig();
      expect(config).toEqual({
        supabaseUrl: 'https://supabase.url',
        supabaseKey: 'anon_key',
        tableName: 'custom_table',
      });
    });
  });

  describe('checkIsBrowser', () => {
    it('should return false in node environment', () => {
      expect(checkIsBrowser()).toBe(false);
    });
  });

  describe('env object', () => {
    it('should have correct boolean flags', () => {
      expect(env.isDevelopment).toBe(false);
      expect(env.isProduction).toBe(false);
      expect(env.isTest).toBe(false);
      expect(env.isBrowser).toBe(false);
      expect(env.isServer).toBe(true);
    });
  });
});
