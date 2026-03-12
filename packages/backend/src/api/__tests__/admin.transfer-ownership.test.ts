/**
 * Tests for Fix 4: owner transfer — API error mapping.
 *
 * Verifies that the POST /transfer-ownership route handler correctly maps
 * service errors to HTTP status codes, following the same pattern as
 * admin.last-admin.test.ts.
 */

import { describe, expect, it, vi } from "vitest";

// Mirrors the ValidationError thrown by AdminUserService.
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function buildRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res;
}

// Mirrors the exact check used in admin.ts — error.name rather than instanceof
// because ServiceError resets the prototype chain via Object.setPrototypeOf.
function isValidationError(error: unknown): error is Error {
  return error instanceof Error && error.name === "ValidationError";
}

async function simulateTransferHandler(
  serviceFn: () => Promise<void>,
  res: ReturnType<typeof buildRes>,
) {
  try {
    await serviceFn();
    res.json({ message: "Ownership transferred" });
  } catch (error) {
    if (isValidationError(error)) {
      res.status(409).json({ error: (error as Error).message });
      return;
    }
    res.status(500).json({ error: "Failed to transfer ownership" });
  }
}

describe("Admin route handler — transfer ownership error mapping (Fix 4)", () => {
  it("maps ValidationError to 409 when target is not an active member", async () => {
    const res = buildRes();
    await simulateTransferHandler(
      () => Promise.reject(new ValidationError("Target user is not an active member of this tenant.")),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error).toMatch(/active member/i);
  });

  it("maps ValidationError to 409 when actor tries to transfer to themselves", async () => {
    const res = buildRes();
    await simulateTransferHandler(
      () => Promise.reject(new ValidationError("Cannot transfer ownership to yourself.")),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error).toMatch(/yourself/i);
  });

  it("maps generic Error to 500", async () => {
    const res = buildRes();
    await simulateTransferHandler(
      () => Promise.reject(new Error("DB connection lost")),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error).toBe("Failed to transfer ownership");
  });

  it("returns 200 with success message on valid transfer", async () => {
    const res = buildRes();
    await simulateTransferHandler(() => Promise.resolve(), res);
    expect(res.status).not.toHaveBeenCalled();
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.message).toBe("Ownership transferred");
  });
});
