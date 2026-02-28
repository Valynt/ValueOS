import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clientRateLimit } from "../ClientRateLimit";
import { NetworkSegmentationManager } from "../NetworkSegmentation";
import { securityEvents } from "../security/securityLogger";
import { assertSafeUrl } from "../security/ssrfGuard";

// Mock dependencies
vi.mock("../ClientRateLimit");
vi.mock("../security/ssrfGuard");
vi.mock("../security/securityLogger");

describe("NetworkSegmentationManager Security Tests", () => {
  let networkManager: NetworkSegmentationManager;
  let mockRateLimit: unknown;
  let mockSSRFGuard: unknown;
  let mockSecurityEvents: unknown;

  beforeEach(() => {
    mockRateLimit = {
      checkLimit: vi.fn().mockResolvedValue(true),
    };

    mockSSRFGuard = {
      assertSafeUrl: vi.fn().mockResolvedValue(true),
    };

    mockSecurityEvents = {
      logSecurityEvent: vi.fn(),
    };

    (clientRateLimit as any).checkLimit = mockRateLimit.checkLimit;
    (assertSafeUrl as any) = mockSSRFGuard.assertSafeUrl;
    (securityEvents as any).logSecurityEvent = mockSecurityEvents.logSecurityEvent;

    networkManager = new NetworkSegmentationManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Request Validation", () => {
    it("should validate legitimate external URLs", async () => {
      const request = {
        url: "https://api.example.com/data",
        method: "GET",
        agentType: "expansion-agent",
        agentId: "exp-123",
      };

      mockSSRFGuard.assertSafeUrl.mockResolvedValue(true);

      const result = await networkManager.validateRequest(request);

      expect(result.allowed).toBe(true);
      expect(result.policy).toBeDefined();
      expect(mockSSRFGuard.assertSafeUrl).toHaveBeenCalledWith("https://api.example.com/data");
    });

    it("should block internal URLs", async () => {
      const request = {
        url: "http://localhost:3000/admin",
        method: "GET",
        agentType: "opportunity-agent",
        agentId: "opp-123",
      };

      mockSSRFGuard.assertSafeUrl.mockRejectedValue(new Error("SSRF attempt blocked"));

      const result = await networkManager.validateRequest(request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("blocked");
    });

    it("should block private IP ranges", async () => {
      const privateUrls = [
        "http://192.168.1.1/config",
        "http://10.0.0.1/internal",
        "http://172.16.0.1/private",
        "http://127.0.0.1/debug",
      ];

      for (const url of privateUrls) {
        const request = {
          url,
          method: "GET",
          agentType: "target-agent",
          agentId: "target-123",
        };

        mockSSRFGuard.assertSafeUrl.mockRejectedValue(new Error("Private IP blocked"));

        const result = await networkManager.validateRequest(request);
        expect(result.allowed).toBe(false);
      }
    });

    it("should enforce agent-specific policies", async () => {
      // Test opportunity agent restrictions
      const request = {
        url: "https://external-api.com/data",
        method: "GET",
        agentType: "opportunity-agent",
        agentId: "opp-123",
      };

      mockSSRFGuard.assertSafeUrl.mockResolvedValue(true);

      const result = await networkManager.validateRequest(request);
      expect(result.allowed).toBe(true);

      // Verify policy has appropriate restrictions
      const policy = result.policy!;
      expect(policy.agentTypes).toContain("opportunity-agent");
    });
  });

  describe("Rate Limiting Integration", () => {
    it("should check rate limits for each request", async () => {
      const request = {
        url: "https://api.example.com/data",
        method: "GET",
        agentType: "expansion-agent",
        agentId: "exp-123",
      };

      mockSSRFGuard.assertSafeUrl.mockResolvedValue(true);
      mockRateLimit.checkLimit.mockResolvedValue(true);

      await networkManager.validateRequest(request);

      expect(mockRateLimit.checkLimit).toHaveBeenCalledWith("api-calls");
    });

    it("should block requests when rate limited", async () => {
      const request = {
        url: "https://api.example.com/data",
        method: "GET",
        agentType: "expansion-agent",
        agentId: "exp-123",
      };

      mockSSRFGuard.assertSafeUrl.mockResolvedValue(true);
      mockRateLimit.checkLimit.mockResolvedValue(false);

      const result = await networkManager.validateRequest(request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("rate limit");
    });
  });

  describe("Concurrent Connection Limits", () => {
    it("should enforce concurrent connection limits", async () => {
      const request = {
        url: "https://api.example.com/data",
        method: "GET",
        agentType: "expansion-agent",
        agentId: "exp-123",
      };

      mockSSRFGuard.assertSafeUrl.mockResolvedValue(true);
      mockRateLimit.checkLimit.mockResolvedValue(true);

      // Start multiple concurrent requests
      const promises = Array(6)
        .fill(null)
        .map(() => networkManager.executeRequest(request));

      const results = await Promise.allSettled(promises);

      // Some should fail due to connection limits
      const rejected = results.filter((r) => r.status === "rejected");
      expect(rejected.length).toBeGreaterThan(0);
    });
  });

  describe("Security Event Logging", () => {
    it("should log security events for blocked requests", async () => {
      const request = {
        url: "http://internal.server/admin",
        method: "POST",
        agentType: "integrity-agent",
        agentId: "int-123",
      };

      mockSSRFGuard.assertSafeUrl.mockRejectedValue(new Error("SSRF blocked"));

      await networkManager.validateRequest(request);

      expect(mockSecurityEvents.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ssrf_attempt_blocked",
          agentType: "integrity-agent",
          agentId: "int-123",
          url: "http://internal.server/admin",
        })
      );
    });

    it("should log successful requests for audit", async () => {
      const request = {
        url: "https://api.example.com/data",
        method: "GET",
        agentType: "realization-agent",
        agentId: "real-123",
      };

      mockSSRFGuard.assertSafeUrl.mockResolvedValue(true);
      mockRateLimit.checkLimit.mockResolvedValue(true);

      await networkManager.validateRequest(request);

      expect(mockSecurityEvents.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "network_request_allowed",
          agentType: "realization-agent",
          agentId: "real-123",
        })
      );
    });
  });

  describe("Agent-Specific Network Wrappers", () => {
    it("should provide agent-specific request methods", async () => {
      const options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "test" }),
        priority: "high" as const,
      };

      const mockExecuteRequest = vi.fn().mockResolvedValue({
        success: true,
        data: { result: "success" },
      });

      networkManager.executeRequest = mockExecuteRequest;

      await networkManager.executeAgentRequest(
        "target-agent",
        "target-123",
        "https://api.example.com/endpoint",
        options
      );

      expect(mockExecuteRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.example.com/endpoint",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: "test" }),
          agentType: "target-agent",
          agentId: "target-123",
          priority: "high",
        })
      );
    });
  });

  describe("Domain Allow/Block Lists", () => {
    it("should allow requests to whitelisted domains", async () => {
      const request = {
        url: "https://trusted-api.com/v1/data",
        method: "GET",
        agentType: "expansion-agent",
        agentId: "exp-123",
      };

      mockSSRFGuard.assertSafeUrl.mockResolvedValue(true);

      const result = await networkManager.validateRequest(request);

      expect(result.allowed).toBe(true);
    });

    it("should block requests to blacklisted domains", async () => {
      const request = {
        url: "https://blocked-domain.com/malicious",
        method: "GET",
        agentType: "expansion-agent",
        agentId: "exp-123",
      };

      mockSSRFGuard.assertSafeUrl.mockResolvedValue(true);

      // Override policy to include blocked domain
      const policies = (networkManager as any).policies;
      policies[0].blockedDomains = ["blocked-domain.com"];

      const result = await networkManager.validateRequest(request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("blocked");
    });
  });

  describe("Request Retry and Timeout", () => {
    it("should retry failed requests according to policy", async () => {
      const request = {
        url: "https://unreliable-api.com/data",
        method: "GET",
        agentType: "expansion-agent",
        agentId: "exp-123",
      };

      mockSSRFGuard.assertSafeUrl.mockResolvedValue(true);
      mockRateLimit.checkLimit.mockResolvedValue(true);

      // Mock fetch to fail twice then succeed
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: "success" }),
        });

      const result = await networkManager.executeRequest(request);

      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(result.success).toBe(true);
    });

    it("should timeout requests that take too long", async () => {
      const request = {
        url: "https://slow-api.com/data",
        method: "GET",
        agentType: "expansion-agent",
        agentId: "exp-123",
      };

      mockSSRFGuard.assertSafeUrl.mockResolvedValue(true);
      mockRateLimit.checkLimit.mockResolvedValue(true);

      // Mock fetch to never resolve
      global.fetch = vi.fn(() => new Promise(() => {})); // Never resolves

      const timeoutPromise = networkManager.executeRequest(request);

      // Should timeout within reasonable time
      await expect(timeoutPromise).rejects.toThrow(/timeout/i);
    });
  });
});
