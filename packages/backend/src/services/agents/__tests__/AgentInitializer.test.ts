import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCachedAgentHealth, clearHealthCache } from "../AgentInitializer.js";
import { AgentAPI } from "../AgentAPI.js";

vi.mock("../../config/environment.js", () => ({
  getConfig: vi.fn(() => ({
    app: { env: "test" },
    agents: {
      apiUrl: "http://test-api",
      circuitBreaker: {
        enabled: false,
        threshold: 5,
        cooldown: 10000,
      },
      logging: false,
    },
  })),
  isProduction: vi.fn(() => false),
}));

vi.mock("../AgentAPI.js", () => ({
  AgentAPI: vi.fn().mockImplementation(() => ({
    invokeAgent: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

describe("AgentInitializer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearHealthCache(); // Start each test with a clean state
  });

  describe("clearHealthCache", () => {
    it("should force a new health check on the next getCachedAgentHealth call", async () => {
      // First call should trigger a network request
      await getCachedAgentHealth();

      // Get the mocked invokeAgent function from the first instance
      const invokeAgentMock = vi.mocked(AgentAPI).mock.results[0].value.invokeAgent;

      // Verify invokeAgent was called (because cache was empty)
      expect(invokeAgentMock).toHaveBeenCalled();

      // Clear the mock history to count calls accurately for the next part
      invokeAgentMock.mockClear();

      // Second call should return from cache without network request
      await getCachedAgentHealth();
      expect(invokeAgentMock).not.toHaveBeenCalled();

      // Clear the cache
      clearHealthCache();

      // Third call should trigger a network request again
      await getCachedAgentHealth();

      // We need to get the invokeAgent mock again in case a new AgentAPI instance was created.
      // initializeAgents creates a new AgentAPI instance each time.
      const newInstanceMock = vi.mocked(AgentAPI).mock.results[1].value.invokeAgent;
      expect(newInstanceMock).toHaveBeenCalled();
    });
  });
});
