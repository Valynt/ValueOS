import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../../../../lib/logger.js"
import { supabase } from "../../../../../lib/supabase.js"
import { AgentContext } from "../../../types.js"
import { ActivateCustomer } from "../activate-customer.js"

// Mock dependencies
vi.mock("../../../../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

vi.mock("../../../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ActivateCustomer", () => {
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

  describe("successful execution", () => {
    it("should activate a customer successfully", async () => {
      const input = {
        customerId: "550e8400-e29b-41d4-a716-446655440000",
        activationCode: "123456",
      };

      const mockCustomer = {
        id: input.customerId,
        email: "test@example.com",
        status: "pending",
        activation_code: "123456",
        activation_code_expires_at: new Date(
          Date.now() + 3600000
        ).toISOString(),
      };

      // Mock sequence for validateBusinessRules and performActivation
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValueOnce({ data: mockCustomer, error: null }) // validation
          .mockResolvedValueOnce({
            data: { ...mockCustomer, status: "active" },
            error: null,
          }), // activation
        update: vi.fn().mockReturnThis(),
      });

      const result = await tool.execute(input, mockContext);

      expect(result.success).toBe(true);
      expect(result.customerEmail).toBe("test@example.com");
      expect(logger.info).toHaveBeenCalledWith(
        "Customer activated successfully",
        expect.any(Object)
      );
    });

    it("should validate input schema", async () => {
      const invalidInput = {
        customerId: "invalid-uuid",
        activationCode: "short",
      };

      await expect(
        tool.execute(invalidInput as any, mockContext)
      ).rejects.toThrow("Input validation failed");
    });
  });

  describe("business rules", () => {
    it("should fail if customer is not found", async () => {
      const input = {
        customerId: "550e8400-e29b-41d4-a716-446655440000",
        activationCode: "123456",
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: null, error: new Error("Not found") }),
      });

      await expect(tool.execute(input, mockContext)).rejects.toThrow(
        "Customer 550e8400-e29b-41d4-a716-446655440000 not found or not accessible"
      );
    });

    it("should fail if customer status is not pending", async () => {
      const input = {
        customerId: "550e8400-e29b-41d4-a716-446655440000",
        activationCode: "123456",
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: { status: "active" }, error: null }),
      });

      await expect(tool.execute(input, mockContext)).rejects.toThrow(
        "Customer is not in pending status (current: active)"
      );
    });

    it("should fail if activation code does not match", async () => {
      const input = {
        customerId: "550e8400-e29b-41d4-a716-446655440000",
        activationCode: "wrong-code",
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { status: "pending", activation_code: "123456" },
          error: null,
        }),
      });

      await expect(tool.execute(input, mockContext)).rejects.toThrow(
        "Invalid activation code provided"
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "Invalid activation code attempt",
        expect.any(Object)
      );
    });

    it("should fail if activation code is expired", async () => {
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
            activation_code_expires_at: new Date(
              Date.now() - 3600000
            ).toISOString(),
          },
          error: null,
        }),
      });

      await expect(tool.execute(input, mockContext)).rejects.toThrow(
        "Activation code has expired"
      );
    });
  });

  describe("authorization", () => {
    it("should check for tenant access", async () => {
      const input = {
        customerId: "550e8400-e29b-41d4-a716-446655440000",
        activationCode: "123456",
      };

      const wrongTenantContext = {
        ...mockContext,
        tenantId: "wrong-tenant-id",
      };

      // Base tool handles tenant access check if called, but ActivateCustomer calls it explicitly in executeBusinessLogic
      // We need to mock the validation step first
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            status: "pending",
            activation_code: "123456",
            tenant_id: "test-tenant-id",
          },
          error: null,
        }),
      });

      await expect(tool.execute(input, wrongTenantContext)).rejects.toThrow(
        "Tenant access denied"
      );
    });
  });

  describe("error handling", () => {
    it("should handle database errors during activation", async () => {
      const input = {
        customerId: "550e8400-e29b-41d4-a716-446655440000",
        activationCode: "123456",
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValueOnce({
            data: { status: "pending", activation_code: "123456" },
            error: null,
          })
          .mockResolvedValueOnce({
            data: null,
            error: { message: "DB Error" },
          }),
        update: vi.fn().mockReturnThis(),
      });

      await expect(tool.execute(input, mockContext)).rejects.toThrow(
        "Failed to activate customer: DB Error"
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Customer activation database error",
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
});
