/**
 * billing-mutation-requires-mfa -- integration test
 *
 * Billing POST/PATCH endpoints that mutate subscription state are gated behind
 * requireMFA. A request without MFA verification must receive HTTP 403.
 *
 * The billing router mounts requireMFA on /subscription, /plan-change,
 * /payment-methods, /execution-control, and /overrides.
 */

import { describe, expect, it, vi } from "vitest";

// -- Mocks for auth middleware --
// Stub requireAuth to attach a minimal user (simulates logged-in user)
vi.mock("../../../middleware/auth.js", () => ({
  requireAuth: (
    req: { user?: Record<string, unknown> },
    _res: unknown,
    next: () => void
  ) => {
    req.user = { id: "user-1", email: "u@test.com" };
    next();
  },
  // requireMFA: user has MFA enabled but session does NOT carry MFA proof => 403
  requireMFA: vi.fn(
    async (
      req: { user?: { id?: string } },
      res: { status: (c: number) => { json: (b: unknown) => void } },
      _next: () => void
    ) => {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      // No amr claim in session => 403
      res.status(403).json({
        error: "MFA required",
        message: "This resource requires a session authenticated with MFA",
      });
    }
  ),
}));

vi.mock("../../../middleware/rbac.js", () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) =>
    next(),
}));

vi.mock("../../../middleware/securityMiddleware.js", () => ({
  securityHeadersMiddleware: (_req: unknown, _res: unknown, next: () => void) =>
    next(),
}));

vi.mock("../../../middleware/serviceIdentityMiddleware.js", () => ({
  serviceIdentityMiddleware: (_req: unknown, _res: unknown, next: () => void) =>
    next(),
}));

vi.mock("../../../middleware/tenantContext.js", () => ({
  tenantContextMiddleware:
    () => (_req: unknown, _res: unknown, next: () => void) =>
      next(),
}));

vi.mock("../../../middleware/tenantDbContext.js", () => ({
  tenantDbContextMiddleware:
    () => (_req: unknown, _res: unknown, next: () => void) =>
      next(),
}));

// Stub sub-routers so we don't need real service deps
function stubRouter() {
  // Lazy import to avoid top-level side effects
  const { Router } = require("express");
  const r = Router();
  r.post("/", (_req: unknown, res: { json: (b: unknown) => void }) =>
    res.json({ ok: true })
  );
  return { default: r };
}
vi.mock("../subscriptions.js", () => stubRouter());
vi.mock("../invoices.js", () => stubRouter());
vi.mock("../overrides.js", () => stubRouter());
vi.mock("../payment-methods.js", () => stubRouter());
vi.mock("../plan-change.js", () => stubRouter());
vi.mock("../plans.js", () => stubRouter());
vi.mock("../summary.js", () => stubRouter());
vi.mock("../usage.js", () => stubRouter());
vi.mock("../webhooks.js", () => stubRouter());
vi.mock("../execution-control.js", () => stubRouter());

// -- Tests --
describe("billing-mutation-requires-mfa", () => {
  it("POST /api/billing/subscription without MFA returns 403", async () => {
    // Import express and billing router dynamically after all mocks are in place
    const express = (await import("express")).default;
    const { default: billingRouter } = await import("../index.js");

    const app = express();
    app.use(express.json());
    app.use("/api/billing", billingRouter);

    // Use node:http to send a request
    const http = await import("node:http");
    const server = http.createServer(app);

    const result = await new Promise<{ status: number; body: unknown }>(
      (resolve, reject) => {
        server.listen(0, () => {
          const addr = server.address();
          if (!addr || typeof addr === "string") {
            reject(new Error("Could not get server address"));
            return;
          }
          const options = {
            hostname: "127.0.0.1",
            port: addr.port,
            path: "/api/billing/subscription",
            method: "POST",
            headers: { "content-type": "application/json" },
          };
          const req = http.request(options, res => {
            let data = "";
            res.on("data", (chunk: Buffer) => {
              data += chunk;
            });
            res.on("end", () => {
              server.close();
              let parsed: unknown;
              try {
                parsed = JSON.parse(data);
              } catch {
                parsed = data;
              }
              resolve({ status: res.statusCode ?? 500, body: parsed });
            });
          });
          req.on("error", reject);
          req.write(JSON.stringify({ plan: "pro" }));
          req.end();
        });
      }
    );

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ error: "MFA required" });
  });
});
