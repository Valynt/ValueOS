import type { IncomingMessage } from "http";

import { describe, expect, it, vi } from "vitest";

import {
  authenticateWebSocketRequest,
  getRequestedTenantId,
  getWebSocketToken,
  parseBearerToken,
} from "./websocket-request-auth.js";

vi.mock("../middleware/auth.js", () => ({
  extractTenantId: vi.fn(),
  verifyAccessToken: vi.fn(),
}));

import {
  extractTenantId,
  verifyAccessToken,
} from "../middleware/auth.js";

describe("websocket-request-auth seams", () => {
  it("parses valid bearer token headers", () => {
    expect(parseBearerToken("Bearer abc-123")).toBe("abc-123");
    expect(parseBearerToken(["Bearer xyz"])).toBe("xyz");
  });

  it("rejects malformed bearer token headers", () => {
    expect(parseBearerToken(undefined)).toBeNull();
    expect(parseBearerToken("Basic token")).toBeNull();
    expect(parseBearerToken("Bearer   ")).toBeNull();
  });

  it("extracts websocket token from authorization header only", () => {
    const req = {
      headers: {
        authorization: "Bearer ws-token",
      },
    } as Parameters<typeof getWebSocketToken>[0];

    expect(getWebSocketToken(req)).toBe("ws-token");
  });

  it("reads requested tenant id from supported query param aliases", () => {
    const reqWithTenantId = {
      url: "/ws/sdui?tenantId=tenant-a",
    } as Parameters<typeof getRequestedTenantId>[0];
    const reqWithTenantUnderscore = {
      url: "/ws/sdui?tenant_id=tenant-b",
    } as Parameters<typeof getRequestedTenantId>[0];
    const reqWithOrganization = {
      url: "/ws/sdui?organization_id=tenant-c",
    } as Parameters<typeof getRequestedTenantId>[0];

    expect(getRequestedTenantId(reqWithTenantId)).toBe("tenant-a");
    expect(getRequestedTenantId(reqWithTenantUnderscore)).toBe("tenant-b");
    expect(getRequestedTenantId(reqWithOrganization)).toBe("tenant-c");
  });

  it("uses requested tenant when token claims have no tenant and membership allows it", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      user: { id: "user-123" },
      claims: { sub: "user-123" },
    } as never);
    vi.mocked(extractTenantId).mockReturnValue(null);
    const hasTenantAccess = vi.fn().mockResolvedValue(true);
    const ws = { close: vi.fn() } as unknown as Parameters<
      typeof authenticateWebSocketRequest
    >[0];
    const req = {
      headers: { authorization: "Bearer token-1" },
      socket: { remoteAddress: "127.0.0.1" },
      url: "/ws/sdui?tenant_id=tenant-xyz",
    } as unknown as IncomingMessage;

    const result = await authenticateWebSocketRequest(ws, req, {
      tenantResolver: { hasTenantAccess },
      logger: { warn: vi.fn(), info: vi.fn() },
    });

    expect(result).toEqual({ userId: "user-123", tenantId: "tenant-xyz" });
    expect(hasTenantAccess).toHaveBeenCalledWith("user-123", "tenant-xyz");
    expect(ws.close).not.toHaveBeenCalled();
  });

  it("denies requested tenant when membership check fails", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      user: { id: "user-123" },
      claims: { sub: "user-123" },
    } as never);
    vi.mocked(extractTenantId).mockReturnValue(null);
    const ws = { close: vi.fn() } as unknown as Parameters<
      typeof authenticateWebSocketRequest
    >[0];
    const req = {
      headers: { authorization: "Bearer token-2" },
      socket: { remoteAddress: "127.0.0.1" },
      url: "/ws/sdui?tenantId=tenant-denied",
    } as unknown as IncomingMessage;

    const result = await authenticateWebSocketRequest(ws, req, {
      tenantResolver: { hasTenantAccess: vi.fn().mockResolvedValue(false) },
      logger: { warn: vi.fn(), info: vi.fn() },
    });

    expect(result).toBeNull();
    expect(ws.close).toHaveBeenCalledWith(1008, "Tenant access denied");
  });
});
