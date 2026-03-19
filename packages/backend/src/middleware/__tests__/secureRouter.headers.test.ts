import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../rateLimiter.js", () => ({
  RateLimitTier: {
    STANDARD: "standard",
    STRICT: "strict",
  },
  rateLimiters: {
    standard: (_req: unknown, _res: unknown, next: () => void) => next(),
    strict: (_req: unknown, _res: unknown, next: () => void) => next(),
  },
}));

vi.mock("../requestAuditMiddleware.js", () => ({
  requestAuditMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../serviceIdentityMiddleware.js", () => ({
  serviceIdentityMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../sessionTimeoutMiddleware.js", () => ({
  sessionTimeoutMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { createSecureRouter } from "../secureRouter.js";

describe("createSecureRouter security headers", () => {
  it("preserves nonce-based CSP and modern security headers for strict routes", async () => {
    const app = express();
    const router = createSecureRouter("strict");

    router.get("/probe", (_req, res) => {
      res.status(200).json({ ok: true, nonce: res.locals.cspNonce });
    });

    app.use("/secure", router);

    const response = await request(app)
      .get("/secure/probe")
      .set("Cookie", "csrf_token=test-token")
      .set("x-csrf-token", "test-token");

    expect(response.status).toBe(200);
    expect(response.body.nonce).toBeTruthy();
    expect(response.headers["content-security-policy"]).toContain(
      `script-src 'self' 'nonce-${response.body.nonce}'`
    );
    expect(response.headers["content-security-policy"]).toContain(
      `style-src 'self' 'nonce-${response.body.nonce}'`
    );
    expect(response.headers["content-security-policy"]).not.toContain("'unsafe-inline'");
    expect(response.headers["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains; preload"
    );
    expect(response.headers["permissions-policy"]).toContain("camera=()");
    expect(response.headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(response.headers["cross-origin-embedder-policy"]).toBe("require-corp");
    expect(response.headers["cross-origin-resource-policy"]).toBe("same-origin");
  });
});
