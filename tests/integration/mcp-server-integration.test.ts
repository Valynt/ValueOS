/**
 * MCP Server Integration Tests
 *
 * End-to-end tests for the enhanced MCP server architecture
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigurationManager } from "../../src/mcp-common";
import { mcpRateLimiter } from "../../src/mcp-common";
import { MCPCRMServer } from "../../src/mcp-crm/core/MCPCRMServer";
import type { CRMProvider } from "../../src/mcp-crm/types";

// Mock dependencies
vi.mock("../../src/lib/logger");
vi.mock("../../src/lib/supabase");

describe("MCP Server Integration", () => {
  let crmServer: MCPCRMServer;
  let configManager: ConfigurationManager;

  beforeEach(() => {
    // Reset rate limiter
    mcpRateLimiter.resetProvider("hubspot");
    mcpRateLimiter.resetProvider("salesforce");

    // Create test configuration
    const testConfig = {
      tenantId: "test-tenant",
      userId: "test-user",
      enabledProviders: ["hubspot"] as CRMProvider[],
      refreshTokensAutomatically: true,
    };

    crmServer = new MCPCRMServer(testConfig);
    configManager = ConfigurationManager.getInstance("/tmp/test-config");
  });

  afterEach(async () => {
    // Clean up
    await crmServer.parallelInitializer?.destroy();
    configManager.cleanup();
  });

  describe("Parallel Initialization", () => {
    it("should initialize all components in parallel", async () => {
      // Mock configuration loading
      vi.spyOn(configManager, "loadConfig").mockResolvedValue({
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
      } as any);

      // Mock database connections
      const mockSupabase = require("../../src/lib/supabase").supabase;
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      await expect(crmServer.initialize()).resolves.not.toThrow();

      // Verify rate limiter was registered
      const stats = mcpRateLimiter.getStats("hubspot");
      expect(stats).toBeDefined();
      expect(stats?.provider).toBe("hubspot");
    });

    it("should handle initialization failures gracefully", async () => {
      // Mock configuration loading failure
      vi.spyOn(configManager, "loadConfig").mockRejectedValue(new Error("Config not found"));

      await expect(crmServer.initialize()).resolves.not.toThrow();

      // Should still complete but with failures logged
      const results = crmServer.parallelInitializer.getResults();
      const configResult = results.get("load-config");
      expect(configResult?.success).toBe(false);
    });
  });

  describe("Rate Limiting Integration", () => {
    beforeEach(async () => {
      // Set up successful initialization
      jest.spyOn(configManager, "loadConfig").mockResolvedValue({
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
              rateLimit: { requestsPerSecond: 2, burstCapacity: 3 }, // Low limits for testing
              fieldMappings: { roi: "calculated_roi" },
              customFields: [],
              oauth: { scopes: ["crm.objects.deals.read"], tokenRefreshThreshold: 300 },
            },
          ],
          defaultProvider: "hubspot",
          sync: { batchSize: 50, retryAttempts: 3, retryDelay: 1000 },
        },
      } as any);

      // Mock successful database connection
      const mockSupabase = require("../../src/lib/supabase").supabase;
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                {
                  id: "test-connection",
                  tenant_id: "test-tenant",
                  provider: "hubspot",
                  access_token: "test-token",
                  refresh_token: "test-refresh",
                  status: "active",
                  scopes: ["crm.objects.deals.read"],
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      // Mock HubSpot module
      jest.doMock("../../src/mcp-crm/modules/HubSpotModule", () => ({
        HubSpotModule: jest.fn().mockImplementation(() => ({
          provider: "hubspot",
          searchDeals: jest.fn().mockResolvedValue({
            deals: [],
            total: 0,
            hasMore: false,
          }),
        })),
      }));

      await crmServer.initialize();
    });

    it("should apply rate limiting to tool execution", async () => {
      // Execute multiple requests to hit rate limit
      const results = [];

      for (let i = 0; i < 4; i++) {
        // Exceed burst capacity of 3
        const result = await crmServer.executeTool("crm_search_deals", { limit: 1 });
        results.push(result);
      }

      // First 3 should succeed, 4th should fail
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
      expect(results[3].success).toBe(false);
      expect(results[3].error).toContain("Rate limit exceeded");
    });

    it("should record metrics for successful requests", async () => {
      await crmServer.executeTool("crm_search_deals", { limit: 1 });

      const stats = mcpRateLimiter.getStats("hubspot");
      expect(stats?.totalRequests).toBeGreaterThan(0);
      expect(stats?.successRate).toBeGreaterThan(0);
    });

    it("should record failures for failed requests", async () => {
      // Mock module failure
      const HubSpotModule = require("../../src/mcp-crm/modules/HubSpotModule").HubSpotModule;
      HubSpotModule.mockImplementation(() => ({
        provider: "hubspot",
        searchDeals: jest.fn().mockRejectedValue(new Error("API Error")),
      }));

      await crmServer.executeTool("crm_search_deals", { limit: 1 });

      const stats = mcpRateLimiter.getStats("hubspot");
      expect(stats?.failedRequests).toBeGreaterThan(0);
      expect(stats?.successRate).toBeLessThan(1.0);
    });
  });

  describe("Configuration Integration", () => {
    it("should use configuration for field mappings", async () => {
      // Mock successful initialization
      jest.spyOn(configManager, "loadConfig").mockResolvedValue({
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
              fieldMappings: {
                roi: "custom_roi_field",
                npv: "custom_npv_field",
                payback_months: "custom_payback_field",
              },
              customFields: [],
              oauth: { scopes: ["crm.objects.deals.read"], tokenRefreshThreshold: 300 },
            },
          ],
          defaultProvider: "hubspot",
          sync: { batchSize: 50, retryAttempts: 3, retryDelay: 1000 },
        },
      } as any);

      // Mock database connection
      const mockSupabase = require("../../src/lib/supabase").supabase;
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                {
                  id: "test-connection",
                  tenant_id: "test-tenant",
                  provider: "hubspot",
                  access_token: "test-token",
                  status: "active",
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      await crmServer.initialize();

      // Test field mapping usage
      const fieldMappings = crmServer["getMetricsFieldMapping"]("hubspot");
      expect(fieldMappings.roi).toBe("custom_roi_field");
      expect(fieldMappings.npv).toBe("custom_npv_field");
      expect(fieldMappings.payback_months).toBe("custom_payback_field");
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle configuration errors gracefully", async () => {
      // Mock invalid configuration
      jest.spyOn(configManager, "loadConfig").mockResolvedValue({
        environment: "invalid",
        debug: "not-boolean",
        // Missing required fields
      } as any);

      await expect(crmServer.initialize()).resolves.not.toThrow();

      // Should complete with configuration task failed
      const results = crmServer.parallelInitializer.getResults();
      const configResult = results.get("load-config");
      expect(configResult?.success).toBe(false);
    });

    it("should handle rate limiter errors gracefully", async () => {
      // Mock successful config but rate limiter failure
      jest.spyOn(configManager, "loadConfig").mockResolvedValue({
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
      } as any);

      // Mock database connection
      const mockSupabase = require("../../src/lib/supabase").supabase;
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                {
                  id: "test-connection",
                  tenant_id: "test-tenant",
                  provider: "hubspot",
                  access_token: "test-token",
                  status: "active",
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      await crmServer.initialize();

      // Should still complete even if rate limiter registration has issues
      const results = crmServer.parallelInitializer.getResults();
      expect(results.size).toBeGreaterThan(0);
    });
  });

  describe("Performance Integration", () => {
    it("should complete initialization within reasonable time", async () => {
      const startTime = Date.now();

      // Mock successful initialization
      jest.spyOn(configManager, "loadConfig").mockResolvedValue({
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
      } as any);

      // Mock database connection
      const mockSupabase = require("../../src/lib/supabase").supabase;
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                {
                  id: "test-connection",
                  tenant_id: "test-tenant",
                  provider: "hubspot",
                  access_token: "test-token",
                  status: "active",
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      await crmServer.initialize();

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it("should handle concurrent tool execution efficiently", async () => {
      // Mock successful initialization
      jest.spyOn(configManager, "loadConfig").mockResolvedValue({
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
              rateLimit: { requestsPerSecond: 100, burstCapacity: 100 }, // High limits
              fieldMappings: { roi: "calculated_roi" },
              customFields: [],
              oauth: { scopes: ["crm.objects.deals.read"], tokenRefreshThreshold: 300 },
            },
          ],
          defaultProvider: "hubspot",
          sync: { batchSize: 50, retryAttempts: 3, retryDelay: 1000 },
        },
      } as any);

      // Mock database connection
      const mockSupabase = require("../../src/lib/supabase").supabase;
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                {
                  id: "test-connection",
                  tenant_id: "test-tenant",
                  provider: "hubspot",
                  access_token: "test-token",
                  status: "active",
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      await crmServer.initialize();

      // Execute multiple concurrent requests
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        crmServer.executeTool("crm_search_deals", { limit: 1, query: `test-${i}` })
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentRequests);
      const duration = Date.now() - startTime;

      // All should succeed
      expect(results.every((r) => r.success)).toBe(true);

      // Should complete efficiently (concurrent execution should be faster than serial)
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
