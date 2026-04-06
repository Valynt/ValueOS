import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isKafkaEnabled, buildKafkaClientConfig } from '../kafkaConfig.js';

vi.mock('node:fs', () => ({
  default: {
    readFileSync: vi.fn((path: string) => Buffer.from(`mocked-content-of-${path}`)),
  },
}));

describe('kafkaConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('isKafkaEnabled', () => {
    it('returns false when neither KAFKA_ENABLED nor EVENT_EXECUTOR_ENABLED are true', () => {
      delete process.env.KAFKA_ENABLED;
      delete process.env.EVENT_EXECUTOR_ENABLED;
      expect(isKafkaEnabled()).toBe(false);

      process.env.KAFKA_ENABLED = 'false';
      process.env.EVENT_EXECUTOR_ENABLED = 'false';
      expect(isKafkaEnabled()).toBe(false);
    });

    it('returns true when KAFKA_ENABLED is true', () => {
      process.env.KAFKA_ENABLED = 'true';
      delete process.env.EVENT_EXECUTOR_ENABLED;
      expect(isKafkaEnabled()).toBe(true);
    });

    it('returns true when EVENT_EXECUTOR_ENABLED is true', () => {
      delete process.env.KAFKA_ENABLED;
      process.env.EVENT_EXECUTOR_ENABLED = 'true';
      expect(isKafkaEnabled()).toBe(true);
    });

    it('returns true when both are true', () => {
      process.env.KAFKA_ENABLED = 'true';
      process.env.EVENT_EXECUTOR_ENABLED = 'true';
      expect(isKafkaEnabled()).toBe(true);
    });
  });

  describe('buildKafkaClientConfig', () => {
    const baseConfig = { clientId: 'test-client', brokers: ['localhost:9092'] };

    it('builds basic config without ssl or sasl', () => {
      delete process.env.KAFKA_SSL_ENABLED;
      delete process.env.KAFKA_SECURITY_PROTOCOL;
      delete process.env.KAFKA_SASL_MECHANISM;

      const config = buildKafkaClientConfig(baseConfig);

      expect(config).toEqual({
        ...baseConfig,
        ssl: undefined,
        sasl: undefined,
      });
    });

    it('enables SSL based on KAFKA_SSL_ENABLED', () => {
      process.env.KAFKA_SSL_ENABLED = 'true';

      const config = buildKafkaClientConfig(baseConfig);

      expect(config.ssl).toEqual({
        rejectUnauthorized: true,
        ca: undefined,
        cert: undefined,
        key: undefined,
      });
    });

    it('enables SSL based on KAFKA_SECURITY_PROTOCOL', () => {
      process.env.KAFKA_SECURITY_PROTOCOL = 'SASL_SSL';

      const config = buildKafkaClientConfig(baseConfig);

      expect(config.ssl).toBeDefined();
    });

    it('configures SSL with certificates if paths are provided', () => {
      process.env.KAFKA_SSL_ENABLED = 'true';
      process.env.KAFKA_SSL_CA_PATH = '/path/to/ca';
      process.env.KAFKA_SSL_CERT_PATH = '/path/to/cert';
      process.env.KAFKA_SSL_KEY_PATH = '/path/to/key';

      const config = buildKafkaClientConfig(baseConfig);

      expect(config.ssl).toEqual({
        rejectUnauthorized: true,
        ca: [Buffer.from('mocked-content-of-/path/to/ca')],
        cert: Buffer.from('mocked-content-of-/path/to/cert'),
        key: Buffer.from('mocked-content-of-/path/to/key'),
      });
    });

    it('disables rejectUnauthorized if KAFKA_SSL_REJECT_UNAUTHORIZED is false', () => {
      process.env.KAFKA_SSL_ENABLED = 'true';
      process.env.KAFKA_SSL_REJECT_UNAUTHORIZED = 'false';

      const config = buildKafkaClientConfig(baseConfig);

      expect(config.ssl).toMatchObject({
        rejectUnauthorized: false,
      });
    });

    it('configures SASL if mechanism, username, and password are provided', () => {
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

    it('does not configure SASL if any credential part is missing', () => {
      process.env.KAFKA_SASL_MECHANISM = 'plain';
      process.env.KAFKA_SASL_USERNAME = 'user';
      delete process.env.KAFKA_SASL_PASSWORD;

      const config = buildKafkaClientConfig(baseConfig);

      expect(config.sasl).toBeUndefined();
    });
  });
});
