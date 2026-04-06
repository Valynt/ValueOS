import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isKafkaEnabled, buildKafkaClientConfig } from "../kafkaConfig";

vi.mock("node:fs", () => ({
  default: {
    readFileSync: vi.fn(),
  },
}));

describe("kafkaConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("isKafkaEnabled", () => {
    it("should return true when KAFKA_ENABLED is 'true'", () => {
      vi.stubEnv("KAFKA_ENABLED", "true");
      vi.stubEnv("EVENT_EXECUTOR_ENABLED", "false");
      expect(isKafkaEnabled()).toBe(true);
    });

    it("should return true when EVENT_EXECUTOR_ENABLED is 'true'", () => {
      vi.stubEnv("KAFKA_ENABLED", "false");
      vi.stubEnv("EVENT_EXECUTOR_ENABLED", "true");
      expect(isKafkaEnabled()).toBe(true);
    });

    it("should return true when both are 'true'", () => {
      vi.stubEnv("KAFKA_ENABLED", "true");
      vi.stubEnv("EVENT_EXECUTOR_ENABLED", "true");
      expect(isKafkaEnabled()).toBe(true);
    });

    it("should return false when neither is 'true'", () => {
      vi.stubEnv("KAFKA_ENABLED", "false");
      vi.stubEnv("EVENT_EXECUTOR_ENABLED", "false");
      expect(isKafkaEnabled()).toBe(false);
    });

    it("should return false when environment variables are missing", () => {
      vi.stubEnv("KAFKA_ENABLED", "");
      vi.stubEnv("EVENT_EXECUTOR_ENABLED", "");
      expect(isKafkaEnabled()).toBe(false);
    });
  });

  describe("buildKafkaClientConfig", () => {
    it("should build basic config without ssl or sasl", () => {
      vi.stubEnv("KAFKA_SSL_ENABLED", "");
      vi.stubEnv("KAFKA_SECURITY_PROTOCOL", "");
      vi.stubEnv("KAFKA_SASL_MECHANISM", "");

      const baseConfig = { clientId: "test-client", brokers: ["localhost:9092"] };
      const config = buildKafkaClientConfig(baseConfig);

      expect(config).toEqual({
        clientId: "test-client",
        brokers: ["localhost:9092"],
        ssl: undefined,
        sasl: undefined,
      });
    });

    it("should enable SSL via KAFKA_SSL_ENABLED", () => {
      vi.stubEnv("KAFKA_SSL_ENABLED", "true");

      const config = buildKafkaClientConfig({ clientId: "test", brokers: ["localhost:9092"] });

      expect(config.ssl).toBeDefined();
      expect(config.ssl).toMatchObject({
        rejectUnauthorized: true, // Default
      });
    });

    it("should enable SSL via KAFKA_SECURITY_PROTOCOL=SSL", () => {
      vi.stubEnv("KAFKA_SECURITY_PROTOCOL", "SSL");

      const config = buildKafkaClientConfig({ clientId: "test", brokers: ["localhost:9092"] });

      expect(config.ssl).toBeDefined();
    });

    it("should enable SSL via KAFKA_SECURITY_PROTOCOL=SASL_SSL", () => {
      vi.stubEnv("KAFKA_SECURITY_PROTOCOL", "SASL_SSL");

      const config = buildKafkaClientConfig({ clientId: "test", brokers: ["localhost:9092"] });

      expect(config.ssl).toBeDefined();
    });

    it("should respect KAFKA_SSL_REJECT_UNAUTHORIZED='false'", () => {
      vi.stubEnv("KAFKA_SSL_ENABLED", "true");
      vi.stubEnv("KAFKA_SSL_REJECT_UNAUTHORIZED", "false");

      const config = buildKafkaClientConfig({ clientId: "test", brokers: ["localhost:9092"] });

      expect(config.ssl).toMatchObject({
        rejectUnauthorized: false,
      });
    });

    it("should read certificates if paths are provided", async () => {
      const mockFs = await import("node:fs");
      const readFileSyncMock = mockFs.default.readFileSync as unknown as ReturnType<typeof vi.fn>;
      const buffer = Buffer.from("mock-cert");
      readFileSyncMock.mockReturnValue(buffer);

      vi.stubEnv("KAFKA_SSL_ENABLED", "true");
      vi.stubEnv("KAFKA_SSL_CA_PATH", "/path/to/ca");
      vi.stubEnv("KAFKA_SSL_CERT_PATH", "/path/to/cert");
      vi.stubEnv("KAFKA_SSL_KEY_PATH", "/path/to/key");

      const config = buildKafkaClientConfig({ clientId: "test", brokers: ["localhost:9092"] });

      expect(readFileSyncMock).toHaveBeenCalledTimes(3);
      expect(readFileSyncMock).toHaveBeenCalledWith("/path/to/ca");
      expect(readFileSyncMock).toHaveBeenCalledWith("/path/to/cert");
      expect(readFileSyncMock).toHaveBeenCalledWith("/path/to/key");

      expect(config.ssl).toMatchObject({
        ca: [buffer],
        cert: buffer,
        key: buffer,
      });
    });

    it("should configure SASL when mechanism, username, and password are provided", () => {
      vi.stubEnv("KAFKA_SASL_MECHANISM", "plain");
      vi.stubEnv("KAFKA_SASL_USERNAME", "user");
      vi.stubEnv("KAFKA_SASL_PASSWORD", "password");

      const config = buildKafkaClientConfig({ clientId: "test", brokers: ["localhost:9092"] });

      expect(config.sasl).toEqual({
        mechanism: "plain",
        username: "user",
        password: "password",
      });
    });

    it("should not configure SASL if missing username", () => {
      vi.stubEnv("KAFKA_SASL_MECHANISM", "plain");
      vi.stubEnv("KAFKA_SASL_USERNAME", "");
      vi.stubEnv("KAFKA_SASL_PASSWORD", "password");

      const config = buildKafkaClientConfig({ clientId: "test", brokers: ["localhost:9092"] });

      expect(config.sasl).toBeUndefined();
    });
  });
});
