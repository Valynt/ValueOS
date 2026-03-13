import { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { requireObservabilityAccess } from "../observabilityAccess.js";

const logAuditMock = vi.fn();

vi.mock("../../services/AuditLogService.js", () => ({
  auditLogService: {
    logAudit: logAuditMock,
  },
}));

describe("requireObservabilityAccess", () => {
  it("denies cross-tenant observability access and writes audit log", async () => {
    const middleware = requireObservabilityAccess();
    const req = {
      tenantId: "tenant-a",
      query: { tenantId: "tenant-b", environment: "production" },
      user: { id: "user-1", email: "user@example.com", roles: ["security_analyst"] },
      path: "/api/security/events",
      ip: "127.0.0.1",
      get: vi.fn().mockReturnValue("test-agent"),
      requestId: "req-1",
    } as Partial<Request> as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as Partial<Response> as Response;

    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledTimes(1);
  });

  it("allows tenant-scoped observability access with proper role", async () => {
    const middleware = requireObservabilityAccess();
    const req = {
      tenantId: "tenant-a",
      query: { tenantId: "tenant-a", environment: "staging" },
      user: { id: "user-1", email: "user@example.com", roles: ["admin"] },
    } as Partial<Request> as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as Partial<Response> as Response;

    const next = vi.fn();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
