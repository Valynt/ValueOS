/**
 * BillingApprovalService Tests
 *
 * Validates approval request lifecycle, policy enforcement, and auto-approval.
 */

import type { ApprovalActionType } from "@shared/types/billing-events";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

let mockChainResult: { data: unknown; error: unknown } = { data: null, error: null };
const mockFrom = vi.fn();

const createChain = (): Record<string, unknown> => {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "upsert", "eq", "is", "gt", "lt", "order"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(mockChainResult));
  chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    Promise.resolve(mockChainResult).then(resolve, reject);
  return chain;
};

vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: {
    from: (table: string) => {
      mockFrom(table);
      return createChain();
    },
  },
}));

vi.mock("../../../lib/logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BillingApprovalService", () => {
  let BillingApprovalService: { BillingApprovalService: new () => Record<string, (...args: unknown[]) => Promise<unknown>> };
  let service: Record<string, (...args: unknown[]) => Promise<unknown>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    BillingApprovalService = await import("../BillingApprovalService");
    service = new BillingApprovalService.BillingApprovalService();
  });

  describe("createApprovalRequest", () => {
    it("creates a pending request when no auto-approve threshold", async () => {
      // First call: getApprovalPolicy returns null (no policy)
      // Second call: insert returns the new request
      let callCount = 0;
      mockChainResult = {
        get data() {
          callCount++;
          if (callCount <= 1) {
            // getApprovalPolicy - no policy found
            return null;
          }
          // insert result
          return {
            approval_id: "req-1",
            tenant_id: "t-1",
            action_type: "plan_change",
            status: "pending",
            requested_by_user_id: "u-1",
            payload: { from: "free", to: "standard" },
          };
        },
        get error() {
          if (callCount <= 1) return { code: "PGRST116" };
          return null;
        },
      };

      const result = await service.createApprovalRequest(
        "t-1",
        "plan_change" as ApprovalActionType,
        { from: "free", to: "standard" },
        "u-1"
      ) as Record<string, unknown>;

      expect(result.approval_id).toBe("req-1");
      expect(result.status).toBe("pending");
      expect(mockFrom).toHaveBeenCalledWith("billing_approval_policies");
      expect(mockFrom).toHaveBeenCalledWith("billing_approval_requests");
    });

    it("auto-approves when cost is below threshold", async () => {
      let callCount = 0;
      mockChainResult = {
        get data() {
          callCount++;
          if (callCount <= 1) {
            // getApprovalPolicy returns policy with auto_approve_below
            return {
              id: "pol-1",
              tenant_id: "t-1",
              action_type: "plan_change",
              thresholds: { auto_approve_below: 100 },
              required_approver_roles: ["admin"],
              sla_hours: 24,
            };
          }
          // insert result - auto-approved
          return {
            approval_id: "req-2",
            tenant_id: "t-1",
            action_type: "plan_change",
            status: "approved",
            approved_by_user_id: "auto",
          };
        },
        get error() {
          return null;
        },
      };

      const result = await service.createApprovalRequest(
        "t-1",
        "plan_change" as ApprovalActionType,
        { from: "free", to: "standard" },
        "u-1",
        { estimatedCost: 50 }
      ) as Record<string, unknown>;

      expect(result.status).toBe("approved");
      expect(result.approved_by_user_id).toBe("auto");
    });
  });

  describe("approveRequest", () => {
    it("approves a pending request", async () => {
      mockChainResult = {
        data: {
          approval_id: "req-1",
          status: "approved",
          approved_by_user_id: "admin-1",
          decision_reason: "Looks good",
        },
        error: null,
      };

      const result = await service.approveRequest("req-1", "admin-1", "Looks good") as Record<string, unknown>;
      expect(result.status).toBe("approved");
      expect(result.approved_by_user_id).toBe("admin-1");
      expect(mockFrom).toHaveBeenCalledWith("billing_approval_requests");
    });

    it("throws when request not found or not pending", async () => {
      mockChainResult = {
        data: null,
        error: { code: "PGRST116", message: "not found" },
      };

      await expect(
        service.approveRequest("nonexistent", "admin-1")
      ).rejects.toThrow("Failed to approve");
    });
  });

  describe("rejectRequest", () => {
    it("rejects a pending request with reason", async () => {
      mockChainResult = {
        data: {
          approval_id: "req-1",
          status: "rejected",
          approved_by_user_id: "admin-1",
          decision_reason: "Budget exceeded",
        },
        error: null,
      };

      const result = await service.rejectRequest("req-1", "admin-1", "Budget exceeded") as Record<string, unknown>;
      expect(result.status).toBe("rejected");
      expect(result.decision_reason).toBe("Budget exceeded");
    });
  });

  describe("getApprovalPolicy", () => {
    it("returns policy for tenant + action type", async () => {
      mockChainResult = {
        data: {
          id: "pol-1",
          tenant_id: "t-1",
          action_type: "plan_change",
          thresholds: { auto_approve_below: 100 },
          required_approver_roles: ["admin", "owner"],
          sla_hours: 48,
        },
        error: null,
      };

      const policy = await service.getApprovalPolicy("t-1", "plan_change" as ApprovalActionType) as Record<string, unknown>;
      expect(policy).not.toBeNull();
      expect(policy.action_type).toBe("plan_change");
      expect(policy.sla_hours).toBe(48);
    });

    it("returns null when no policy exists", async () => {
      mockChainResult = { data: null, error: { code: "PGRST116", message: "not found" } };

      const policy = await service.getApprovalPolicy("t-1", "cancel" as ApprovalActionType);
      expect(policy).toBeNull();
    });
  });

  describe("setApprovalPolicy", () => {
    it("upserts policy for tenant + action type", async () => {
      mockChainResult = {
        data: {
          id: "pol-1",
          tenant_id: "t-1",
          action_type: "seat_change",
          thresholds: { auto_approve_below: 50 },
          required_approver_roles: ["admin"],
          sla_hours: 12,
        },
        error: null,
      };

      const policy = await service.setApprovalPolicy(
        "t-1",
        "seat_change" as ApprovalActionType,
        { auto_approve_below: 50 },
        ["admin"],
        12
      ) as Record<string, unknown>;

      expect(policy.action_type).toBe("seat_change");
      expect(policy.sla_hours).toBe(12);
      expect(mockFrom).toHaveBeenCalledWith("billing_approval_policies");
    });
  });

  describe("getPendingRequests", () => {
    it("returns pending non-expired requests for tenant", async () => {
      mockChainResult = {
        data: [
          { approval_id: "req-1", status: "pending", action_type: "plan_change" },
          { approval_id: "req-2", status: "pending", action_type: "seat_change" },
        ],
        error: null,
      };

      const requests = await service.getPendingRequests("t-1") as unknown[];
      expect(requests).toHaveLength(2);
    });
  });

  describe("expirePendingRequests", () => {
    it("expires past-due pending requests", async () => {
      mockChainResult = {
        data: [{ approval_id: "req-old-1" }, { approval_id: "req-old-2" }],
        error: null,
      };

      const count = await service.expirePendingRequests();
      expect(count).toBe(2);
    });

    it("returns 0 when no requests to expire", async () => {
      mockChainResult = { data: [], error: null };

      const count = await service.expirePendingRequests();
      expect(count).toBe(0);
    });
  });
});
