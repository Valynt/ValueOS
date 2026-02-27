/**
 * Sprint 1 Security Controls Tests
 *
 * Tests for security hardening implemented in Sprint 1:
 * 1. Service identity fail-fast in production
 * 2. WebSocket query-string token rejection in production
 * 3. Metrics endpoint protection
 *
 * @security These tests validate P0/P1 security controls
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serviceIdentityMiddleware } from "../serviceIdentityMiddleware";

// Mock the autonomy config module
vi.mock("../../config/autonomy", () => ({
  getAutonomyConfig: vi.fn(),
}));

// Mock the nonce store
vi.mock("../nonceStore", () => ({
  nonceStore: {
    consumeOnce: vi.fn().mockResolvedValue(true),
  },
  NonceStoreUnavailableError: class extends Error {},
}));

import { getAutonomyConfig } from "../../config/autonomy";

function mockReq(headers: Record<string, string> = {}) {
  return {
    header: vi.fn((name: string) => headers[name.toLowerCase()]),
  } as any;
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

describe("Sprint 1: Service Identity Fail-Fast", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.clearAllMocks();
  });

  describe("Production environment without token", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
      (getAutonomyConfig as any).mockReturnValue({ serviceIdentityToken: "" });
    });

    it("returns 503 when SERVICE_IDENTITY_TOKEN is missing in production", () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      serviceIdentityMiddleware(req, res as any, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: "Service unavailable: identity configuration missing",
        code: "SERVICE_IDENTITY_NOT_CONFIGURED",
      });
      expect(next).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[FATAL] SERVICE_IDENTITY_TOKEN not configured")
      );

      consoleErrorSpy.mockRestore();
    });

    it("logs FATAL error when token missing in production", () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      serviceIdentityMiddleware(req, res as any, next);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain("[FATAL]");

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Development environment without token", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
      (getAutonomyConfig as any).mockReturnValue({ serviceIdentityToken: "" });
    });

    it("allows bypass with warning in development", () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      serviceIdentityMiddleware(req, res as any, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WARN] SERVICE_IDENTITY_TOKEN not set")
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe("Token validation", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
      (getAutonomyConfig as any).mockReturnValue({ serviceIdentityToken: "valid-token" });
    });

    it("rejects mismatched token", () => {
      const req = mockReq({
        "x-service-identity": "wrong-token",
        "x-request-timestamp": Date.now().toString(),
        "x-request-nonce": "nonce-123",
      });
      const res = mockRes();
      const next = vi.fn();

      serviceIdentityMiddleware(req, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Service identity verification failed" });
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects expired timestamp", () => {
      const expiredTimestamp = Date.now() - 3 * 60 * 1000; // 3 minutes ago
      const req = mockReq({
        "x-service-identity": "valid-token",
        "x-request-timestamp": expiredTimestamp.toString(),
        "x-request-nonce": "nonce-123",
      });
      const res = mockRes();
      const next = vi.fn();

      serviceIdentityMiddleware(req, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Request timestamp invalid or expired" });
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects missing nonce", () => {
      const req = mockReq({
        "x-service-identity": "valid-token",
        "x-request-timestamp": Date.now().toString(),
      });
      const res = mockRes();
      const next = vi.fn();

      serviceIdentityMiddleware(req, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Request nonce required" });
      expect(next).not.toHaveBeenCalled();
    });
  });
});

describe("Sprint 1: Clock Skew Protection", () => {
  const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000; // 2 minutes

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    (getAutonomyConfig as any).mockReturnValue({ serviceIdentityToken: "valid-token" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("accepts timestamp within clock skew tolerance", async () => {
    const slightlyOldTimestamp = Date.now() - 60 * 1000; // 1 minute ago
    const req = mockReq({
      "x-service-identity": "valid-token",
      "x-request-timestamp": slightlyOldTimestamp.toString(),
      "x-request-nonce": "nonce-123",
    });
    const res = mockRes();
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      serviceIdentityMiddleware(req, res as any, () => {
        next();
        resolve();
      });
    });

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects timestamp outside clock skew tolerance", () => {
    const tooOldTimestamp = Date.now() - MAX_CLOCK_SKEW_MS - 1000;
    const req = mockReq({
      "x-service-identity": "valid-token",
      "x-request-timestamp": tooOldTimestamp.toString(),
      "x-request-nonce": "nonce-123",
    });
    const res = mockRes();
    const next = vi.fn();

    serviceIdentityMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Request timestamp invalid or expired" });
  });

  it("rejects future timestamp outside clock skew tolerance", () => {
    const futureTimestamp = Date.now() + MAX_CLOCK_SKEW_MS + 1000;
    const req = mockReq({
      "x-service-identity": "valid-token",
      "x-request-timestamp": futureTimestamp.toString(),
      "x-request-nonce": "nonce-123",
    });
    const res = mockRes();
    const next = vi.fn();

    serviceIdentityMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
