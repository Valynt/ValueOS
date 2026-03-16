import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestPasswordResetMock = vi.fn();
const resendMock = vi.fn();
const logAuditMock = vi.fn();
const warnMock = vi.fn();
const getUserByEmailMock = vi.fn();

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: warnMock,
  }),
}));

vi.mock("@shared/lib/piiFilter", () => ({
  sanitizeForLogging: (value: string) => value,
}));

vi.mock("@shared/lib/supabase", () => ({
  createServerSupabaseClient: () => ({
    auth: {
      resend: resendMock,
      admin: {
        getUserByEmail: getUserByEmailMock,
      },
    },
  }),
}));

vi.mock("../../middleware/secureRouter.js", async () => {
  const expressModule = await import("express");
  return {
    createSecureRouter: () => expressModule.Router(),
  };
});

vi.mock("../../middleware/authRateLimiter.js", () => ({
  authRateLimiter: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
  recordAuthFailure: vi.fn(),
}));

vi.mock("../../middleware/inputValidation.js", () => ({
  validateRequest: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
  ValidationSchemas: {
    login: {},
    signup: {},
    updatePassword: {},
  },
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../middleware/mfa.js", () => ({
  requireMFA: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../../config/environment.js", () => ({
  getConfig: () => ({
    app: { url: "http://localhost:3000" },
  }),
}));

vi.mock("../../services/auth/AuthService.js", () => ({
  authService: {
    requestPasswordReset: requestPasswordResetMock,
  },
}));

vi.mock("../../services/security/AuditLogService.js", () => ({
  auditLogService: {
    logAudit: logAuditMock,
  },
}));

vi.mock("../../services/auth/UserProfileDirectoryService.js", () => ({
  userProfileDirectoryService: {
    syncProfile: vi.fn(),
  },
}));

vi.mock("../../middleware/requestAuditMiddleware.js", () => ({
  emitRequestAuditEvent: vi.fn(),
}));

describe("auth audit paths", () => {
  beforeEach(() => {
    requestPasswordResetMock.mockResolvedValue(undefined);
    resendMock.mockResolvedValue({ error: null });
    logAuditMock.mockResolvedValue(undefined);
    getUserByEmailMock.mockReset();
    warnMock.mockReset();
    vi.clearAllMocks();
  });

  it("does not write password reset audit record when admin lookup returns null user", async () => {
    getUserByEmailMock.mockResolvedValue({ data: { user: null }, error: null });

    const { default: router } = await import("../auth.js");
    const app = express();
    app.use(express.json());
    app.use("/auth", router);

    const response = await request(app)
      .post("/auth/password/reset")
      .send({ email: "missing@example.com" });

    expect(response.status).toBe(200);
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("continues verification resend flow when admin lookup throws", async () => {
    getUserByEmailMock.mockRejectedValue(new Error("lookup failed"));

    const { default: router } = await import("../auth.js");
    const app = express();
    app.use(express.json());
    app.use("/auth", router);

    const response = await request(app)
      .post("/auth/verify/resend")
      .send({ email: "user@example.com" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Verification email resent" });
    expect(logAuditMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalledWith("Verification audit lookup failed", {
      errorMsg: "Error: lookup failed",
    });
  });
});
