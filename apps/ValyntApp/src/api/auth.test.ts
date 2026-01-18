// @vitest-environment node
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock security middlewares to bypass them in unit tests
vi.mock("../middleware/securityMiddleware", () => ({
  csrfProtectionMiddleware: (req: any, res: any, next: any) => next(),
  securityHeadersMiddleware: (req: any, res: any, next: any) => next(),
}));

vi.mock("../middleware/serviceIdentityMiddleware", () => ({
  serviceIdentityMiddleware: (req: any, res: any, next: any) => next(),
}));

vi.mock("../middleware/sessionTimeoutMiddleware", () => ({
  sessionTimeoutMiddleware: (req: any, res: any, next: any) => next(),
}));

// Mock rate limiter
vi.mock("../middleware/rateLimiter", () => ({
  rateLimiters: {
    strict: (req: any, res: any, next: any) => next(),
    standard: (req: any, res: any, next: any) => next(),
  },
}));

// Mock AuditLogService to avoid DB writes and hash chain initialization
vi.mock("../services/AuditLogService", () => ({
  auditLogService: {
    logAudit: vi.fn().mockResolvedValue({ id: "mock-audit-id" }),
    createEntry: vi.fn().mockResolvedValue({ id: "mock-audit-id" }),
  },
}));
vi.mock("../services/SecurityAuditService", () => ({
  securityAuditService: {
    logAction: vi.fn().mockResolvedValue(undefined),
    logRequestEvent: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("../services/AuthService", () => ({
  authService: {
    login: vi.fn().mockResolvedValue({
      user: { id: "user-123", email: "test@example.com", user_metadata: {} },
      session: { access_token: "at", refresh_token: "rt", expires_at: 3600 },
    }),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
  },
}));

import router from "./auth";

describe("auth api router", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", router);

  it("returns success for login", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" });
    expect(res.status).toBe(200);
  });

  it("returns success for password reset", async () => {
    const res = await request(app)
      .post("/api/auth/password/reset")
      .send({ email: "test@example.com" });
    expect(res.status).toBe(200);
  });
});
