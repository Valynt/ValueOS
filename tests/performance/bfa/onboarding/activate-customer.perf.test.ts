import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabase } from "../../../../src/lib/supabase";
import { BfaTelemetry } from "../../../../src/services/bfa/telemetry";
import { ActivateCustomer } from "../../../../src/services/bfa/tools/onboarding/activate-customer";
import { AgentContext } from "../../../../src/services/bfa/types";

// Mock dependencies
vi.mock("../../../../src/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

vi.mock("../../telemetry", () => ({
  BfaTelemetry: {
    recordExecution: vi.fn(),
  },
}));

describe("ActivateCustomer Performance & Audit Tests", () => {
  let tool: ActivateCustomer;
  let mockContext: AgentContext;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ActivateCustomer();
    mockContext = {
      userId: "test-user-id",
      tenantId: "test-tenant-id",
      permissions: ["customer:activate", "user:write"],
      requestTime: new Date(),
    };
  });

  describe("Telemetry & Auditing", () => {
    it("should record execution telemetry", async () => {
      const input = {
        customerId: "550e8400-e29b-41d4-a716-446655440000",
        activationCode: "123456",
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            status: "pending",
            activation_code: "123456",
            email: "test@example.com",
          },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      });

      await tool.execute(input, mockContext);

      // Verify telemetry call
      expect(BfaTelemetry.recordExecution).toHaveBeenCalledWith(
        "activate_customer",
        mockContext,
        expect.any(Number),
        expect.any(Object)
      );
    });
  });

  describe("Performance Characteristics", () => {
    it("should execute within acceptable time limits (mocked)", async () => {
      const input = {
        customerId: "550e8400-e29b-41d4-a716-446655440000",
        activationCode: "123456",
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            status: "pending",
            activation_code: "123456",
            email: "test@example.com",
          },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      });

      const start = Date.now();
      await tool.execute(input, mockContext);
      const duration = Date.now() - start;

      // In unit test environment with mocks, it should be very fast (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    it("should handle multiple concurrent activations", async () => {
      const inputs = Array.from({ length: 5 }).map((_, i) => ({
        customerId: `550e8400-e29b-41d4-a716-44665544000${i}`,
        activationCode: "123456",
      }));

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            status: "pending",
            activation_code: "123456",
            email: "test@example.com",
          },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      });

      // Run all concurrently
      const results = await Promise.all(
        inputs.map((input) => tool.execute(input, mockContext))
      );

      expect(results).toHaveLength(5);
      results.forEach((res) => expect(res.success).toBe(true));
    });
  });
});
