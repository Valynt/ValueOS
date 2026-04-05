import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../middleware/auth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      id: "user-1",
      email: "user@example.com",
      tenant_id: "tenant-1",
      user_metadata: { full_name: "Test User" },
    } as unknown as typeof req.user;
    next();
  },
}));

vi.mock("../../middleware/tenantContext", () => ({
  tenantContextMiddleware: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.tenantId = "tenant-1";
    next();
  },
}));

vi.mock("../../middleware/rbac", () => ({
  requirePermission: (permission: string) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader("x-required-permission", permission);
    next();
  },
}));

vi.mock("../../middleware/secureRouter", async () => {
  const expressImport = await import("express");
  return {
    createSecureRouter: () => expressImport.Router(),
  };
});

vi.mock("../../services/crm/IntegrationControlService", () => ({
  integrationControlService: {
    areIntegrationsEnabled: vi.fn(async () => true),
  },
}));

const mockConnectionService = vi.hoisted(() => ({
  listConnections: vi.fn(async () => []),
  connect: vi.fn(async () => ({ id: "int-1", provider: "hubspot", status: "active" })),
  disconnect: vi.fn(async () => ({ id: "int-1", provider: "hubspot", status: "revoked" })),
  rotateCredentials: vi.fn(async () => ({ id: "int-1", provider: "hubspot", status: "active" })),
  testConnection: vi.fn(async () => ({ ok: true, status: "active", message: "ok" })),
  getAuditHistory: vi.fn(async () => [
    {
      id: "audit-1",
      source: "secret_access_audits",
      action: "secret_access:hubspot.access_token",
      decision: "deny",
      reason: "AGENT_NOT_ALLOWED",
      timestamp: new Date().toISOString(),
    },
  ]),
  sync: vi.fn(async () => ({ id: "int-1", provider: "hubspot", status: "active" })),
  getProviderCapabilities: vi.fn(() => [
    {
      provider: "hubspot",
      capabilities: {
        oauth: { supported: true },
        webhook_support: { supported: true },
        delta_sync: { supported: true },
        manual_sync: { supported: true },
        field_mapping: { supported: true },
        backfill: { supported: true },
        test_connection: { supported: true },
        credential_rotation: { supported: true },
      },
    },
  ]),
}));

vi.mock("../../services/crm/IntegrationConnectionService", () => ({
  integrationConnectionService: mockConnectionService,
}));

const mockAuditLog = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../services/security/AuditLogService", () => ({
  auditLogService: {
    logAudit: mockAuditLog,
  },
}));

import integrationsRouter from "../integrations.js";

describe("Integrations API RBAC + audit history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses integrations:disconnect permission for disconnect endpoint", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/integrations", integrationsRouter);

    const res = await request(app).delete("/api/integrations/int-1").expect(200);
    expect(res.headers["x-required-permission"]).toBe("integrations:disconnect");
  });

  it("uses secrets:rotate permission for rotate endpoint", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/integrations", integrationsRouter);

    const res = await request(app)
      .post("/api/integrations/int-1/rotate-secret")
      .send({ accessToken: "token-1234567890" })
      .expect(200);

    expect(res.headers["x-required-permission"]).toBe("secrets:rotate");
    expect(mockConnectionService.rotateCredentials).toHaveBeenCalled();
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "integration_secret_rotated" })
    );
  });

  it("returns secret access allow/deny entries in integration audit history", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/integrations", integrationsRouter);

    const res = await request(app)
      .get("/api/integrations/int-1/audit-history")
      .expect(200);

    expect(res.body.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "secret_access_audits",
          decision: "deny",
          reason: "AGENT_NOT_ALLOWED",
        }),
      ])
    );
  });

  it("returns provider capabilities for UI consumption", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/integrations", integrationsRouter);

    const res = await request(app)
      .get("/api/integrations/capabilities")
      .expect(200);

    expect(res.headers["x-required-permission"]).toBe("integrations:view");
    expect(res.body.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "hubspot",
          capabilities: expect.objectContaining({
            oauth: expect.objectContaining({ supported: true }),
            manual_sync: expect.objectContaining({ supported: true }),
          }),
        }),
      ])
    );
  });
});
