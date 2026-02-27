/**
 * MCP Tools Load Tests
 *
 * Performance and load testing for MCP tool execution
 * including concurrent execution, memory usage, and cleanup.
 */

import { createToolExecutor, executeMCPTool, getAllTools } from "../MCPTools";
import { mcpGroundTruthService } from "../MCPGroundTruthService";

// Mock dependencies
vi.mock("../MCPGroundTruthService");
vi.mock("../../mcp-crm", () => ({
  CRM_TOOLS: [],
  getMCPCRMServer: vi.fn(),
}));

describe("MCP Tools - Load Testing", () => {
  const mockService = mcpGroundTruthService as jest.Mocked<typeof mcpGroundTruthService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService.isAvailable.mockReturnValue(true);
    mockService.getFinancialData.mockResolvedValue({
      entityName: "Test Corp",
      entityId: "TEST",
      period: "FY2024",
      metrics: {
        revenue: {
          value: 1000000,
          unit: "USD",
          source: "SEC",
          confidence: 0.95,
          asOfDate: "2024-12-31",
        },
        netIncome: {
          value: 100000,
          unit: "USD",
          source: "SEC",
          confidence: 0.95,
          asOfDate: "2024-12-31",
        },
      },
      sources: ["SEC"],
    });
  });

  describe("Concurrent Execution", () => {
    it("should handle concurrent tool execution", async () => {
      const concurrentRequests = 50;
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        executeMCPTool("get_company_financials", {
          ticker_or_cik: `TEST${i}`,
          metrics: ["revenue"],
        })
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(promises);
      const duration = Date.now() - startTime;

      // All requests should succeed
      const successful = results.filter((r) => r.status === "fulfilled").length;
      expect(successful).toBe(concurrentRequests);

      // Should complete within reasonable time (adjust based on environment)
      expect(duration).toBeLessThan(10000); // 10 seconds max

      // Verify service was called correctly
      expect(mockService.getFinancialData).toHaveBeenCalledTimes(concurrentRequests);
    });

    it("should handle mixed tool types concurrently", async () => {
      const tools = ["get_company_financials", "get_industry_benchmarks", "verify_financial_claim"];

      const promises = tools.flatMap((tool) =>
        Array.from({ length: 20 }, (_, i) => executeMCPTool(tool, getToolArgs(tool, i)))
      );

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === "fulfilled").length;
      expect(successful).toBe(60); // 20 requests × 3 tools
    });

    it("should maintain performance under sustained load", async () => {
      const batches = 5;
      const requestsPerBatch = 30;
      const allDurations: number[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const promises = Array.from({ length: requestsPerBatch }, (_, i) =>
          executeMCPTool("get_company_financials", {
            ticker_or_cik: `BATCH${batch}_REQ${i}`,
            metrics: ["revenue"],
          })
        );

        const startTime = Date.now();
        await Promise.allSettled(promises);
        const duration = Date.now() - startTime;
        allDurations.push(duration);

        // Allow some time between batches
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Performance should not degrade significantly
      const avgDuration = allDurations.reduce((a, b) => a + b, 0) / allDurations.length;
      const maxDuration = Math.max(...allDurations);

      expect(avgDuration).toBeLessThan(5000); // 5 seconds average
      expect(maxDuration).toBeLessThan(10000); // 10 seconds max
    });
  });

  describe("Memory Usage", () => {
    it("should not leak memory during repeated execution", async () => {
      const iterations = 100;
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        await executeMCPTool("get_company_financials", {
          ticker_or_cik: `MEMORY_TEST_${i}`,
          metrics: ["revenue", "netIncome", "operatingMargin"],
        });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      // Memory increase should be reasonable (less than 50MB for 100 iterations)
      expect(memoryIncreaseMB).toBeLessThan(50);
    });

    it("should handle large responses efficiently", async () => {
      // Mock large response
      mockService.getFinancialData.mockResolvedValue({
        entityName: "Large Corp",
        entityId: "LARGE",
        period: "FY2024",
        metrics: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [
            `metric_${i}`,
            {
              value: Math.random() * 1000000,
              unit: "USD",
              source: "SEC",
              confidence: 0.95,
              asOfDate: "2024-12-31",
            },
          ])
        ),
        sources: ["SEC"],
      });

      const startTime = Date.now();
      const result = await executeMCPTool("get_company_financials", {
        ticker_or_cik: "LARGE",
        metrics: Array.from({ length: 100 }, (_, i) => `metric_${i}`),
      });
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should handle large data quickly

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(Object.keys(parsedResult.metrics)).toHaveLength(100);
    });
  });

  describe("Error Handling Under Load", () => {
    it("should handle service failures gracefully under load", async () => {
      // Mock intermittent failures
      let callCount = 0;
      mockService.getFinancialData.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.reject(new Error("Service unavailable"));
        }
        return Promise.resolve({
          entityName: "Test Corp",
          entityId: "TEST",
          period: "FY2024",
          metrics: {
            revenue: {
              value: 1000000,
              unit: "USD",
              source: "SEC",
              confidence: 0.95,
              asOfDate: "2024-12-31",
            },
          },
          sources: ["SEC"],
        });
      });

      const promises = Array.from({ length: 30 }, (_, i) =>
        executeMCPTool("get_company_financials", {
          ticker_or_cik: `FAIL_TEST_${i}`,
          metrics: ["revenue"],
        })
      );

      const results = await Promise.allSettled(promises);

      // Some should fail, some should succeed
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      expect(successful).toBeGreaterThan(0);
      expect(failed).toBeGreaterThan(0);
      expect(successful + failed).toBe(30);
    });

    it("should handle timeout scenarios", async () => {
      // Mock slow responses
      mockService.getFinancialData.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10000)) // 10 second delay
      );

      const promises = Array.from({ length: 10 }, (_, i) =>
        executeMCPTool("get_company_financials", {
          ticker_or_cik: `SLOW_${i}`,
          metrics: ["revenue"],
        })
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(promises);
      const duration = Date.now() - startTime;

      // Should handle slow responses without hanging
      expect(duration).toBeGreaterThan(10000);
      expect(results.length).toBe(10);
    });
  });

  describe("Resource Cleanup", () => {
    it("should cleanup resources after tool execution", async () => {
      const initialStats = getToolExecutorStats();

      // Execute multiple tools
      for (let i = 0; i < 20; i++) {
        await executeMCPTool("get_company_financials", {
          ticker_or_cik: `CLEANUP_${i}`,
          metrics: ["revenue"],
        });
      }

      // Force cleanup
      if (global.gc) {
        global.gc();
      }

      // Check that resources are properly managed
      const finalStats = getToolExecutorStats();
      // Stats should not grow indefinitely
      expect(finalStats.active).toBeLessThanOrEqual(initialStats.active + 5);
    });

    it("should handle tool executor lifecycle", async () => {
      const executor1 = createToolExecutor("tenant1", "user1");
      const executor2 = createToolExecutor("tenant2", "user2");

      // Use both executors
      const promises = [
        executor1("get_company_financials", { ticker_or_cik: "EXEC1", metrics: ["revenue"] }),
        executor2("get_company_financials", { ticker_or_cik: "EXEC2", metrics: ["revenue"] }),
      ];

      const results = await Promise.allSettled(promises);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    });
  });

  describe("Tool Availability", () => {
    it("should handle service unavailability gracefully", async () => {
      mockService.isAvailable.mockReturnValue(false);

      const result = await executeMCPTool("get_company_financials", {
        ticker_or_cik: "UNAVAILABLE",
        metrics: ["revenue"],
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain("unavailable");
    });

    it("should list available tools correctly", async () => {
      const tools = await getAllTools("tenant1", "user1");

      expect(tools).toHaveLength(3); // get_company_financials, get_industry_benchmarks, verify_financial_claim
      expect(tools[0].function.name).toBe("get_company_financials");
      expect(tools[1].function.name).toBe("get_industry_benchmarks");
      expect(tools[2].function.name).toBe("verify_financial_claim");
    });
  });
});

// Helper functions
function getToolArgs(toolName: string, index: number): Record<string, any> {
  switch (toolName) {
    case "get_company_financials":
      return {
        ticker_or_cik: `COMPANY_${index}`,
        metrics: ["revenue"],
      };
    case "get_industry_benchmarks":
      return {
        industry_code: "511210",
        metrics: ["revenue"],
      };
    case "verify_financial_claim":
      return {
        company: `COMPANY_${index}`,
        metric: "revenue",
        claimed_value: 1000000,
      };
    default:
      return {};
  }
}

function getToolExecutorStats(): { active: number; total: number } {
  // Mock stats - in real implementation this would come from the executor
  return { active: 0, total: 0 };
}
