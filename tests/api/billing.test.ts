/**
 * API Endpoint Tests - Billing
 *
 * Tests for billing endpoints:
 * - GET /api/billing/subscription - Get current subscription
 * - POST /api/billing/subscription - Create subscription
 * - PUT /api/billing/subscription - Update subscription
 * - DELETE /api/billing/subscription - Cancel subscription
 * - GET /api/billing/usage - Get usage summary
 * - GET /api/billing/invoices - Get invoice history
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the API client
vi.mock("@/services/api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "@/services/api/client";
import { billingService } from "@/services/billing/billingService";

const mockApi = vi.mocked(api);

describe("Billing API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/billing/subscription", () => {
    it("should return 404 when no subscription exists", async () => {
      mockApi.get.mockRejectedValue(new Error("Not found"));

      const result = await billingService.getSubscription();

      expect(result).toBeNull();
      expect(mockApi.get).toHaveBeenCalledWith("/billing/subscription");
    });

    it("should return subscription when it exists", async () => {
      const mockSubscription = {
        id: "sub_123",
        tenant_id: "tenant_123",
        status: "active",
        plan_tier: "standard",
        current_period_start: new Date(),
        current_period_end: new Date(),
      };

      mockApi.get.mockResolvedValue(mockSubscription);

      const result = await billingService.getSubscription();

      expect(result).toEqual(mockSubscription);
      expect(result?.status).toBe("active");
      expect(mockApi.get).toHaveBeenCalledWith("/billing/subscription");
    });
  });

  describe("GET /api/billing/usage", () => {
    it("should return usage metrics for a tenant", async () => {
      const mockUsage = [
        {
          metric: "llm_tokens",
          current: 1500,
          limit: 10000,
        },
        {
          metric: "agent_executions",
          current: 25,
          limit: 100,
        },
      ];

      mockApi.get.mockResolvedValue(mockUsage);

      const result = await billingService.getUsage();

      expect(result).toEqual(mockUsage);
      expect(result).toHaveLength(2);
      expect(mockApi.get).toHaveBeenCalledWith("/billing/usage");
    });
  });

  describe("GET /api/billing/invoices", () => {
    it("should return invoice list", async () => {
      const mockInvoices = {
        invoices: [
          {
            id: "inv_123",
            amount: 2999,
            status: "paid",
            date: new Date(),
          },
        ],
      };

      mockApi.get.mockResolvedValue(mockInvoices);

      const result = await billingService.getInvoices();

      expect(result).toEqual(mockInvoices.invoices);
      expect(result).toHaveLength(1);
      expect(mockApi.get).toHaveBeenCalledWith("/billing/invoices");
    });
  });

  describe("PUT /api/billing/subscription", () => {
    it("should change plan successfully", async () => {
      const mockSubscription = {
        id: "sub_123",
        plan_tier: "premium",
        status: "active",
      };

      mockApi.put.mockResolvedValue(mockSubscription);

      const result = await billingService.changePlan("premium");

      expect(result).toEqual(mockSubscription);
      expect(result?.plan_tier).toBe("premium");
      expect(mockApi.put).toHaveBeenCalledWith("/billing/subscription", { planTier: "premium" });
    });
  });

  describe("DELETE /api/billing/subscription", () => {
    it("should cancel subscription", async () => {
      mockApi.delete.mockResolvedValue(undefined);

      await billingService.cancelSubscription();

      expect(mockApi.delete).toHaveBeenCalledWith("/billing/subscription");
    });
  });
});
