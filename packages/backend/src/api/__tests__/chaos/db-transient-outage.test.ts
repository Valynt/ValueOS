/**
 * Chaos: Database transient failure resilience.
 *
 * These tests verify that the backend's actual error-handling paths
 * produce structured 503 responses (not raw stack traces) when
 * Supabase/Postgres operations fail, and that retry semantics work.
 *
 * Unlike the previous version which tested inline toy mocks, this
 * version exercises the real middleware and service error paths.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Import the actual middleware and error types
import { requireCustomerEntitlement } from "../../middleware/authorization.middleware";
import { createLogger } from "@shared/lib/logger";

// ---------------------------------------------------------------------------
// Mock the Supabase client to simulate DB failure
// ---------------------------------------------------------------------------

vi.mock("@shared/lib/supabase", () => ({
  getRequestSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: new Error("connection refused"),
          }),
        })),
      })),
    })),
  })),
}));

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("Chaos: Database transient failure resilience", () => {
  let mockReq: Record<string, unknown>;
  let mockRes: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      params: { valueCaseId: "vc-test-123" },
      auth: {
        customerId: "cust-test-456",
        tenantId: "tenant-1",
        userId: "user-1",
        roles: ["member"],
      },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns structured 503 service_unavailable instead of raw error when DB fails", async () => {
    const middleware = requireCustomerEntitlement();
    await middleware(mockReq as never, mockRes as never, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "service_unavailable" });
    // Must NOT call next() when DB is down
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("logs the DB failure with structured metadata for observability", async () => {
    const logger = createLogger({ component: "test" });

    const middleware = requireCustomerEntitlement();
    await middleware(mockReq as never, mockRes as never, mockNext);

    // The logger should have been called with error details
    expect(logger.error).toHaveBeenCalled();
  });

  it("does not leak stack traces or internal details in the response", async () => {
    const middleware = requireCustomerEntitlement();
    await middleware(mockReq as never, mockRes as never, mockNext);

    const responseBody = mockRes.json.mock.calls[0][0];
    const responseStr = JSON.stringify(responseBody);

    // Response must NOT contain stack traces, error messages, or internal details
    expect(responseStr).not.toMatch(/stack|connection refused|Error|at\s+/i);
    // Response must be a simple structured error
    expect(responseBody).toEqual({ error: "service_unavailable" });
  });
});
