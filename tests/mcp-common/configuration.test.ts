/**
 * Configuration Manager Tests
 *
 * Tests for the MCP configuration management system
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigurationManager, ConfigurationValidator } from "../../src/mcp-common";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

describe("ConfigurationManager", () => {
  let configManager: ConfigurationManager;
  const testConfigDir = "/tmp/mcp-test-config";

  beforeEach(() => {
    configManager = ConfigurationManager.getInstance(testConfigDir);
  });

  afterEach(async () => {
    configManager.cleanup();
    // Clean up test config files
    const files = ["crm-test.json", "financial-test.json", "integrated-test.json"];
    files.forEach((file) => {
      const filePath = join(testConfigDir, file);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    });
  });

  describe("Configuration Validation", () => {
    it("should validate valid CRM configuration", () => {
      const validConfig = {
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
        crm: {
          providers: [
            {
              provider: "hubspot",
              enabled: true,
              rateLimit: {
                requestsPerSecond: 10,
                burstCapacity: 100,
              },
              fieldMappings: {
                roi: "calculated_roi",
                npv: "net_present_value",
              },
              customFields: [],
              oauth: {
                scopes: ["crm.objects.deals.read"],
                tokenRefreshThreshold: 300,
              },
            },
          ],
          defaultProvider: "hubspot",
          sync: {
            batchSize: 50,
            retryAttempts: 3,
            retryDelay: 1000,
          },
        },
      };

      expect(() => ConfigurationValidator.validateCRM(validConfig)).not.toThrow();
    });

    it("should reject invalid CRM configuration", () => {
      const invalidConfig = {
        environment: "invalid",
        debug: "not-boolean",
        logLevel: "invalid",
        timeout: {
          default: -1,
        },
        crm: {
          providers: [],
        },
      };

      expect(() => ConfigurationValidator.validateCRM(invalidConfig)).toThrow();
    });

    it("should validate valid financial configuration", () => {
      const validConfig = {
        environment: "production",
        debug: false,
        logLevel: "info",
        timeout: {
          default: 15000,
          external: 30000,
          database: 5000,
        },
        cache: {
          enabled: true,
          ttl: {
            tier1: 86400,
            tier2: 3600,
            tier3: 900,
          },
          maxSize: 1000,
        },
        financial: {
          modules: {
            edgar: {
              name: "edgar",
              tier: "tier1",
              enabled: true,
              rateLimit: {
                requestsPerSecond: 10,
                burstCapacity: 100,
              },
              timeout: 30000,
              retryAttempts: 3,
              cache: {
                enabled: true,
                ttl: 86400,
              },
            },
            xbrl: {
              name: "xbrl",
              tier: "tier1",
              enabled: true,
              rateLimit: {
                requestsPerSecond: 5,
                burstCapacity: 50,
              },
              timeout: 45000,
              retryAttempts: 2,
              cache: {
                enabled: true,
                ttl: 86400,
              },
            },
            marketData: {
              name: "marketData",
              tier: "tier2",
              enabled: true,
              rateLimit: {
                requestsPerSecond: 20,
                burstCapacity: 200,
              },
              timeout: 15000,
              retryAttempts: 3,
              cache: {
                enabled: true,
                ttl: 3600,
              },
            },
            privateCompany: {
              name: "privateCompany",
              tier: "tier2",
              enabled: true,
              rateLimit: {
                requestsPerSecond: 5,
                burstCapacity: 50,
              },
              timeout: 20000,
              retryAttempts: 2,
              cache: {
                enabled: true,
                ttl: 7200,
              },
            },
            industryBenchmark: {
              name: "industryBenchmark",
              tier: "tier3",
              enabled: true,
              rateLimit: {
                requestsPerSecond: 15,
                burstCapacity: 150,
              },
              timeout: 25000,
              retryAttempts: 3,
              cache: {
                enabled: true,
                ttl: 1800,
              },
            },
          },
          truthLayer: {
            enableFallback: true,
            strictMode: false,
            maxResolutionTime: 60000,
            parallelQuery: true,
          },
        },
      };

      expect(() => ConfigurationValidator.validateFinancial(validConfig)).not.toThrow();
    });

    it("should reject invalid financial configuration", () => {
      const invalidConfig = {
        environment: "production",
        debug: false,
        logLevel: "info",
        timeout: {
          default: 15000,
          external: 30000,
          database: 5000,
        },
        cache: {
          enabled: true,
          ttl: {
            tier1: 86400,
            tier2: 3600,
            tier3: 900,
          },
          maxSize: 1000,
        },
        financial: {
          modules: {
            // Missing required modules
            edgar: {
              name: "edgar",
              tier: "tier1",
              enabled: true,
            },
          },
        },
      };

      expect(() => ConfigurationValidator.validateFinancial(invalidConfig)).toThrow();
    });
  });

  describe("Configuration Loading", () => {
    beforeEach(() => {
      // Create test configuration files
      const crmConfig = {
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

      writeFileSync(join(testConfigDir, "crm-test.json"), JSON.stringify(crmConfig, null, 2));
    });

    it("should load CRM configuration successfully", async () => {
      const config = await configManager.loadConfig("crm", "test");

      expect(config.environment).toBe("test");
      expect(config.debug).toBe(true);
      expect(config.crm.providers).toHaveLength(1);
      expect(config.crm.providers[0].provider).toBe("hubspot");
    });

    it("should cache configuration after loading", async () => {
      await configManager.loadConfig("crm", "test");

      const cachedConfig = configManager.getCachedConfig("crm", "test");
      expect(cachedConfig).toBeDefined();
      expect(cachedConfig!.environment).toBe("test");
    });

    it("should throw error for missing configuration file", async () => {
      await expect(configManager.loadConfig("crm", "missing")).rejects.toThrow();
    });

    it("should throw error for invalid JSON", async () => {
      writeFileSync(join(testConfigDir, "crm-invalid.json"), "{ invalid json }");

      await expect(configManager.loadConfig("crm", "invalid")).rejects.toThrow();
    });

    it("should clear cache when requested", async () => {
      await configManager.loadConfig("crm", "test");
      expect(configManager.getCachedConfig("crm", "test")).toBeDefined();

      configManager.clearCache("crm", "test");
      expect(configManager.getCachedConfig("crm", "test")).toBeUndefined();
    });
  });

  describe("Configuration Validation Helper", () => {
    it("should validate CRM configuration", () => {
      const validConfig = {
        environment: "development",
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

    it("should validate financial configuration", () => {
      const validConfig = {
        environment: "production",
        debug: false,
        logLevel: "info",
        timeout: { default: 15000, external: 30000, database: 5000 },
        cache: { enabled: true, ttl: { tier1: 86400, tier2: 3600, tier3: 900 }, maxSize: 1000 },
        financial: {
          modules: {
            edgar: {
              name: "edgar",
              tier: "tier1",
              enabled: true,
              rateLimit: { requestsPerSecond: 10, burstCapacity: 100 },
              timeout: 30000,
              retryAttempts: 3,
              cache: { enabled: true, ttl: 86400 },
            },
            xbrl: {
              name: "xbrl",
              tier: "tier1",
              enabled: true,
              rateLimit: { requestsPerSecond: 5, burstCapacity: 50 },
              timeout: 45000,
              retryAttempts: 2,
              cache: { enabled: true, ttl: 86400 },
            },
            marketData: {
              name: "marketData",
              tier: "tier2",
              enabled: true,
              rateLimit: { requestsPerSecond: 20, burstCapacity: 200 },
              timeout: 15000,
              retryAttempts: 3,
              cache: { enabled: true, ttl: 3600 },
            },
            privateCompany: {
              name: "privateCompany",
              tier: "tier2",
              enabled: true,
              rateLimit: { requestsPerSecond: 5, burstCapacity: 50 },
              timeout: 20000,
              retryAttempts: 2,
              cache: { enabled: true, ttl: 7200 },
            },
            industryBenchmark: {
              name: "industryBenchmark",
              tier: "tier3",
              enabled: true,
              rateLimit: { requestsPerSecond: 15, burstCapacity: 150 },
              timeout: 25000,
              retryAttempts: 3,
              cache: { enabled: true, ttl: 1800 },
            },
          },
          truthLayer: {
            enableFallback: true,
            strictMode: false,
            maxResolutionTime: 60000,
            parallelQuery: true,
          },
        },
      };

      expect(configManager.validateConfig("financial", validConfig)).toBe(true);
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
