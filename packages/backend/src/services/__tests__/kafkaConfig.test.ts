import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import { isKafkaEnabled, buildKafkaClientConfig } from '../kafkaConfig.js';

vi.mock('node:fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
}));

describe('kafkaConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isKafkaEnabled', () => {
    it('returns true if KAFKA_ENABLED is true', () => {
      process.env.KAFKA_ENABLED = 'true';
      expect(isKafkaEnabled()).toBe(true);
    });

    it('returns true if EVENT_EXECUTOR_ENABLED is true', () => {
      process.env.EVENT_EXECUTOR_ENABLED = 'true';
      expect(isKafkaEnabled()).toBe(true);
    });

    it('returns false if neither is true', () => {
      process.env.KAFKA_ENABLED = 'false';
      process.env.EVENT_EXECUTOR_ENABLED = 'false';
      expect(isKafkaEnabled()).toBe(false);
    });

    it('returns false if env vars are undefined', () => {
      delete process.env.KAFKA_ENABLED;
      delete process.env.EVENT_EXECUTOR_ENABLED;
      expect(isKafkaEnabled()).toBe(false);
    });
  });

  describe('buildKafkaClientConfig', () => {
    const baseConfig = { clientId: 'test-client', brokers: ['localhost:9092'] };

    it('returns base config when no specific SSL or SASL environment variables are set', () => {
      const config = buildKafkaClientConfig(baseConfig);
      expect(config).toEqual({
        ...baseConfig,
        ssl: undefined,
        sasl: undefined,
      });
    });

    it('returns config with SSL enabled when KAFKA_SSL_ENABLED is true', () => {
      process.env.KAFKA_SSL_ENABLED = 'true';
      const config = buildKafkaClientConfig(baseConfig);
      expect(config.ssl).toBeDefined();
      expect(config.ssl).toHaveProperty('rejectUnauthorized', true);
    });

    it('returns config with SSL enabled when KAFKA_SECURITY_PROTOCOL is SSL', () => {
      process.env.KAFKA_SECURITY_PROTOCOL = 'SSL';
      const config = buildKafkaClientConfig(baseConfig);
      expect(config.ssl).toBeDefined();
    });

    it('returns config with SSL enabled when KAFKA_SECURITY_PROTOCOL is SASL_SSL', () => {
      process.env.KAFKA_SECURITY_PROTOCOL = 'SASL_SSL';
      const config = buildKafkaClientConfig(baseConfig);
      expect(config.ssl).toBeDefined();
    });

    it('sets rejectUnauthorized correctly based on KAFKA_SSL_REJECT_UNAUTHORIZED', () => {
      process.env.KAFKA_SSL_ENABLED = 'true';
      process.env.KAFKA_SSL_REJECT_UNAUTHORIZED = 'false';
      const config = buildKafkaClientConfig(baseConfig);
      expect(config.ssl).toHaveProperty('rejectUnauthorized', false);
    });

    it('reads SSL files from paths provided in env vars', () => {
      process.env.KAFKA_SSL_ENABLED = 'true';
      process.env.KAFKA_SSL_CA_PATH = '/path/to/ca';
      process.env.KAFKA_SSL_CERT_PATH = '/path/to/cert';
      process.env.KAFKA_SSL_KEY_PATH = '/path/to/key';

      const mockCaBuffer = Buffer.from('mock-ca');
      const mockCertBuffer = Buffer.from('mock-cert');
      const mockKeyBuffer = Buffer.from('mock-key');

      // @ts-ignore
      fs.readFileSync.mockImplementation((path: string) => {
        if (path === '/path/to/ca') return mockCaBuffer;
        if (path === '/path/to/cert') return mockCertBuffer;
        if (path === '/path/to/key') return mockKeyBuffer;
        return undefined;
      });

      const config = buildKafkaClientConfig(baseConfig);

      expect(config.ssl).toBeDefined();
      // @ts-ignore
      expect(config.ssl.ca).toEqual([mockCaBuffer]);
      // @ts-ignore
      expect(config.ssl.cert).toEqual(mockCertBuffer);
      // @ts-ignore
      expect(config.ssl.key).toEqual(mockKeyBuffer);

      expect(fs.readFileSync).toHaveBeenCalledTimes(3);
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/ca');
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/cert');
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/key');
    });

    it('returns config with SASL settings when all SASL env vars are present', () => {
      process.env.KAFKA_SASL_MECHANISM = 'plain';
      process.env.KAFKA_SASL_USERNAME = 'user';
      process.env.KAFKA_SASL_PASSWORD = 'pass';

      const config = buildKafkaClientConfig(baseConfig);
      expect(config.sasl).toEqual({
        mechanism: 'plain',
        username: 'user',
        password: 'pass',
      });
    });

    it('returns config without SASL settings if mechanism is missing', () => {
      process.env.KAFKA_SASL_USERNAME = 'user';
      process.env.KAFKA_SASL_PASSWORD = 'pass';

      const config = buildKafkaClientConfig(baseConfig);
      expect(config.sasl).toBeUndefined();
    });

    it('returns config without SASL settings if username is missing', () => {
      process.env.KAFKA_SASL_MECHANISM = 'plain';
      process.env.KAFKA_SASL_PASSWORD = 'pass';

      const config = buildKafkaClientConfig(baseConfig);
      expect(config.sasl).toBeUndefined();
    });

    it('returns config without SASL settings if password is missing', () => {
      process.env.KAFKA_SASL_MECHANISM = 'plain';
      process.env.KAFKA_SASL_USERNAME = 'user';

      const config = buildKafkaClientConfig(baseConfig);
      expect(config.sasl).toBeUndefined();
    });
  });
});
