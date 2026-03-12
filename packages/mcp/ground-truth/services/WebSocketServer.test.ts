import { createServer } from "http";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { jwtVerifyMock, createRemoteJWKSetMock } = vi.hoisted(() => ({
  jwtVerifyMock: vi.fn(),
  createRemoteJWKSetMock: vi.fn(),
}));

vi.mock("jose", () => ({
  jwtVerify: jwtVerifyMock,
  createRemoteJWKSet: createRemoteJWKSetMock,
}));

vi.mock("socket.io", () => {
  class FakeServer {
    public use = vi.fn();
    public on = vi.fn();
    public adapter = vi.fn();
    public emit = vi.fn();
    public close = vi.fn();
  }

  return {
    Server: FakeServer,
  };
});

vi.mock("@socket.io/redis-adapter", () => ({
  createAdapter: vi.fn(),
}));

vi.mock("ioredis", () => ({
  Redis: class {
    duplicate() {
      return this;
    }
    on() {
      return undefined;
    }
  },
}));

import { WebSocketServer } from "./WebSocketServer.ts";

describe("WebSocketServer token validation", () => {
  let httpServer = createServer();
  let server: WebSocketServer | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "setInterval").mockReturnValue(1 as unknown as NodeJS.Timeout);

    process.env.WS_AUTH_ISSUER = "https://issuer.example";
    process.env.WS_AUTH_AUDIENCE = "authenticated";
    process.env.WS_AUTH_JWT_SECRET = "super-secret-signing-key";
    process.env.WS_AUTH_PROVIDER_URL = "https://auth.example";
    process.env.WS_AUTH_PROVIDER_API_KEY = "anon-key";
    process.env.CORS_ORIGIN = "http://localhost:3000";

    globalThis.fetch = vi.fn();

    httpServer = createServer();
    server = new WebSocketServer(httpServer);
  });

  afterEach(async () => {
    if (server) {
      await server.shutdown();
    }
    vi.restoreAllMocks();
    delete process.env.WS_AUTH_ISSUER;
    delete process.env.WS_AUTH_AUDIENCE;
    delete process.env.WS_AUTH_JWT_SECRET;
    delete process.env.WS_AUTH_PROVIDER_URL;
    delete process.env.WS_AUTH_PROVIDER_API_KEY;
    delete process.env.CORS_ORIGIN;
  });

  it("accepts valid tokens and derives permissions from roles/entitlements", async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: {
        sub: "user-123",
        tenant_id: "tenant-123",
      },
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-123",
        app_metadata: {
          roles: ["admin"],
          entitlements: ["stream:premium"],
        },
      }),
    } as Response);

    const result = await (server as unknown as { validateAuthToken: (token: string) => Promise<unknown> })
      .validateAuthToken("valid-token");

    expect(result).toEqual({
      userId: "user-123",
      organizationId: "tenant-123",
      permissions: expect.arrayContaining(["basic", "admin", "premium", "role:admin", "stream:premium"]),
    });
  });

  it("rejects expired tokens", async () => {
    jwtVerifyMock.mockRejectedValue(new Error('"exp" claim timestamp check failed'));

    await expect(
      (server as unknown as { validateAuthToken: (token: string) => Promise<unknown> }).validateAuthToken("expired")
    ).rejects.toMatchObject({
      closeCode: 1008,
      closeReason: "Token expired",
    });
  });

  it("rejects malformed tokens", async () => {
    await expect(
      (server as unknown as { validateAuthToken: (token: string) => Promise<unknown> }).validateAuthToken(" ")
    ).rejects.toMatchObject({
      closeCode: 1002,
      closeReason: "Malformed authentication token",
    });
  });

  it("rejects wrong audience tokens", async () => {
    jwtVerifyMock.mockRejectedValue(new Error('unexpected "aud" claim value'));

    await expect(
      (server as unknown as { validateAuthToken: (token: string) => Promise<unknown> }).validateAuthToken("wrong-aud")
    ).rejects.toMatchObject({
      closeCode: 1008,
      closeReason: "Token audience mismatch",
    });
  });

  it("rejects revoked tokens from provider", async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: {
        sub: "user-123",
        tenant_id: "tenant-123",
      },
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    await expect(
      (server as unknown as { validateAuthToken: (token: string) => Promise<unknown> }).validateAuthToken("revoked")
    ).rejects.toMatchObject({
      closeCode: 1008,
      closeReason: "Token revoked",
    });
  });
});
