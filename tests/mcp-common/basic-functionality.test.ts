/**
 * Basic MCP Functionality Tests
 *
 * Simple tests to verify core functionality works
 */

import { beforeEach, describe, expect, it } from "vitest";

import { ConfigurationManager, ConfigurationValidator } from "../../src/mcp-common";

describe("Basic MCP Functionality", () => {
  describe("ConfigurationValidator", () => {
    it("should validate base configuration", () => {
      const validBaseConfig = {
        environment: "development",
        debug: true,
        logLevel: "debug",
        timeout: {
          default: 30000,
          external: 60000,
          database: 10000,
        },
        cache: {
          enabled: true,
          ttl: {
            tier1: 86400,
            tier2: 7200,
            tier3: 1800,
          },
          maxSize: 100,
        },
      };

      expect(() => ConfigurationValidator.validateBase(validBaseConfig)).not.toThrow();
    });

    it("should reject invalid base configuration", () => {
      const invalidBaseConfig = {
        environment: "invalid",
        debug: "not-boolean",
        logLevel: "invalid",
        timeout: {
          default: -1,
        },
        cache: {
          enabled: true,
          ttl: {
            tier1: 86400,
            tier2: 7200,
            tier3: 1800,
          },
          maxSize: 100,
        },
      };

      expect(() => ConfigurationValidator.validateBase(invalidBaseConfig)).toThrow();
    });
  });

  describe("ConfigurationManager", () => {
    let configManager: ConfigurationManager;

    beforeEach(() => {
      configManager = ConfigurationManager.getInstance("/tmp/test-config");
    });

    it("should create singleton instance", () => {
      const instance1 = ConfigurationManager.getInstance();
      const instance2 = ConfigurationManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should validate configuration without throwing", () => {
      const validConfig = {
        environment: "test",
        debug: true,
        logLevel: "debug",
        timeout: { default: 30000, external: 60000, database: 10000 },
        cache: { enabled: true, ttl: { tier1: 86400, tier2: 7200, tier3: 1800 }, maxSize: 100 },
        crm: {
          providers: [
            {
              provider: "hubspot",
              enabled: true,
              rateLimit: { requestsPerSecond: 10, burstCapacity: 100 },
              fieldMappings: { roi: "calculated_roi" },
              customFields: [],
              oauth: { scopes: ["crm.objects.deals.read"], tokenRefreshThreshold: 300 },
            },
          ],
          defaultProvider: "hubspot",
          sync: { batchSize: 50, retryAttempts: 3, retryDelay: 1000 },
        },
      };

      expect(configManager.validateConfig("crm", validConfig)).toBe(true);
    });

    it("should reject invalid configuration", () => {
      const invalidConfig = {
        environment: "invalid",
        debug: "not-boolean",
      };

      expect(configManager.validateConfig("crm", invalidConfig)).toBe(false);
    });
  });
});
