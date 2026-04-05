import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { ingestWebhookMock, logAuditMock } = vi.hoisted(() => ({
  ingestWebhookMock: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuth: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => next(),
}));

vi.mock("../../middleware/rbac", () => ({
  requirePermission:
    () =>
    (
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction
    ) =>
      next(),
}));

vi.mock("../../middleware/tenantContext", () => ({
  tenantContextMiddleware:
    () =>
    (
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction
    ) =>
      next(),
}));

vi.mock("../../middleware/rateLimiter", () => ({
  createRateLimiter:
    () =>
    (
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction
    ) =>
      next(),
}));

vi.mock("../../services/security/AuditLogService", () => ({
  auditLogService: {
    logAudit: logAuditMock,
  },
}));

vi.mock("../../services/crm/CrmWebhookService", () => ({
  CrmWebhookIngestError: class extends Error {
    failure: unknown;

    constructor(failure: unknown) {
      super("CrmWebhookIngestError");
      this.failure = failure;
    }
  },
  crmWebhookService: {
    ingestWebhook: ingestWebhookMock,
  },
}));

vi.mock("../../workers/crmWorker", () => ({
  getCrmSyncQueue: () => ({ add: vi.fn() }),
  getCrmWebhookQueue: () => ({ add: vi.fn() }),
}));

vi.mock("../../services/crm/OAuthStateStore", () => ({
  consumeOAuthState: vi.fn(),
}));

vi.mock("../../services/crm/CrmConnectionService", () => ({
  crmConnectionService: {
    startOAuth: vi.fn(),
    completeOAuthAfterStateValidation: vi.fn(),
    disconnect: vi.fn(),
    getConnection: vi.fn(),
  },
}));

vi.mock("../../services/crm/CrmHealthService", () => ({
  crmHealthService: {
    getHealth: vi.fn(),
  },
}));

vi.mock("../../services/crm/CRMIntegrationService", () => ({
  crmIntegrationService: {
    syncNow: vi.fn(),
    fetchDeals: vi.fn(),
  },
}));

vi.mock("../../services/crm/CrmProviderRegistry", () => ({
  getCrmProvider: vi.fn(),
  getProviderCapabilityRegistry: vi.fn(() => []),
}));

import crmRouter from "../crm";

describe("CRM webhook route middleware and verification outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ingestWebhookMock.mockResolvedValue({
      accepted: true,
      duplicate: false,
      eventId: "evt-123",
    });
    logAuditMock.mockResolvedValue(undefined);
  });

  it("rejects oversized webhook payloads with HTTP 413", async () => {
    const app = express();
    app.use("/api/crm", crmRouter);

    const oversizedPayload = "a".repeat(530_000);
    const response = await request(app)
      .post("/api/crm/hubspot/webhook")
      .set("Content-Type", "application/json")
      .send(`{"blob":"${oversizedPayload}"}`);

    expect(response.status).toBe(413);
    expect(ingestWebhookMock).not.toHaveBeenCalled();
  });

  it("returns 401 when signature verification fails (tampered signature path)", async () => {
    ingestWebhookMock.mockResolvedValue({
      accepted: false,
      duplicate: false,
      failure: {
        classification: "security",
        reason: "invalid_signature",
        retryable: false,
        message: "Invalid webhook signature",
      },
    });

    const app = express();
    app.use("/api/crm", crmRouter);

    const response = await request(app)
      .post("/api/crm/hubspot/webhook")
      .set("Content-Type", "application/json")
      .send([{ portalId: 12345, eventId: "evt-1" }]);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      retryable: false,
      classification: "security",
      reason: "invalid_signature",
      message: "Invalid webhook signature",
    });
  });

  it("returns 503 and Retry-After when ingestion fails with transient classification", async () => {
    ingestWebhookMock.mockResolvedValue({
      accepted: false,
      duplicate: false,
      failure: {
        classification: "transient",
        reason: "queue_unavailable",
        retryable: true,
        message: "Failed to enqueue webhook processing job",
      },
    });

    const app = express();
    app.use("/api/crm", crmRouter);

    const response = await request(app)
      .post("/api/crm/hubspot/webhook")
      .set("Content-Type", "application/json")
      .send([{ portalId: 12345, eventId: "evt-1" }]);

    expect(response.status).toBe(503);
    expect(response.headers["retry-after"]).toBe("5");
    expect(response.body).toEqual({
      ok: false,
      retryable: true,
      classification: "transient",
      reason: "queue_unavailable",
      message: "Failed to enqueue webhook processing job",
    });
  });

  it("returns 400 for validation failures to avoid retries", async () => {
    ingestWebhookMock.mockResolvedValue({
      accepted: false,
      duplicate: false,
      failure: {
        classification: "validation",
        reason: "payload_validation_failed",
        retryable: false,
        message: "Webhook payload failed validation",
      },
    });

    const app = express();
    app.use("/api/crm", crmRouter);

    const response = await request(app)
      .post("/api/crm/hubspot/webhook")
      .set("Content-Type", "application/json")
      .send([{ portalId: 12345, eventId: "evt-1" }]);

    expect(response.status).toBe(400);
    expect(response.headers["retry-after"]).toBeUndefined();
    expect(response.body).toEqual({
      ok: false,
      retryable: false,
      classification: "validation",
      reason: "payload_validation_failed",
      message: "Webhook payload failed validation",
    });
  });

  it("returns 503 when an unexpected exception occurs to trigger provider retries", async () => {
    ingestWebhookMock.mockRejectedValue(new Error("database timeout"));

    const app = express();
    app.use("/api/crm", crmRouter);

    const response = await request(app)
      .post("/api/crm/hubspot/webhook")
      .set("Content-Type", "application/json")
      .send([{ portalId: 12345, eventId: "evt-1" }]);

    expect(response.status).toBe(503);
    expect(response.headers["retry-after"]).toBe("5");
    expect(response.body).toEqual({
      ok: false,
      retryable: true,
      classification: "transient",
      reason: "unexpected_exception",
      message: "Unexpected webhook ingestion failure",
    });
  });

  it("returns 200 when signature verification succeeds", async () => {
    ingestWebhookMock.mockResolvedValue({
      accepted: true,
      duplicate: false,
      eventId: "evt-valid",
    });

    const app = express();
    app.use("/api/crm", crmRouter);

    const response = await request(app)
      .post("/api/crm/hubspot/webhook")
      .set("Content-Type", "application/json")
      .send([{ portalId: 12345, eventId: "evt-1" }]);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      eventId: "evt-valid",
    });
  });
});
