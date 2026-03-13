import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InMemoryRefreshTokenStore, SecureTokenManager } from "./SecureTokenManager";

describe("SecureTokenManager", () => {
  const baseConfig = {
    secret: "test-secure-token-secret",
    issuer: "valueos.tests",
    audience: "valueos.test-clients",
    expiresIn: "1h" as const,
    refreshExpiresIn: "7d" as const,
  };

  it("rejects tampered tokens", () => {
    const manager = new SecureTokenManager(baseConfig);
    const token = manager.generateToken({ sub: "user-1", role: "member" });

    const parts = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ sub: "user-1", role: "admin" }),
      "utf8"
    ).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    expect(manager.verifyToken(tamperedToken)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const manager = new SecureTokenManager(baseConfig);
    const expiredToken = jwt.sign(
      { sub: "user-1" },
      "test-secure-token-secret",
      {
        algorithm: "HS256",
        issuer: "valueos.tests",
        audience: "valueos.test-clients",
        expiresIn: -10,
      }
    );

    expect(manager.verifyToken(expiredToken)).toBeNull();
  });

  it("detects refresh token replay and revokes token family", async () => {
    const store = new InMemoryRefreshTokenStore();
    const manager = new SecureTokenManager({
      ...baseConfig,
      refreshTokenStore: store,
    });

    const originalToken = await manager.issueRefreshToken({
      userId: "user-1",
      tenantId: "tenant-1",
    });

    const firstRotation = await manager.rotateRefreshToken(originalToken);
    expect(firstRotation?.replayDetected).toBe(false);

    const replayAttempt = await manager.rotateRefreshToken(originalToken);
    expect(replayAttempt?.replayDetected).toBe(true);

    const secondRotation = await manager.rotateRefreshToken(firstRotation!.refreshToken);
    expect(secondRotation?.replayDetected).toBe(true);
  });

  it("supports multi-instance rotation with shared durable store assumptions", async () => {
    const store = new InMemoryRefreshTokenStore();
    const managerA = new SecureTokenManager({
      ...baseConfig,
      refreshTokenStore: store,
    });
    const managerB = new SecureTokenManager({
      ...baseConfig,
      refreshTokenStore: store,
    });

    const token = await managerA.issueRefreshToken({
      userId: "user-1",
      tenantId: "tenant-1",
      deviceId: "device-1",
    });

    const rotated = await managerB.rotateRefreshToken(token);
    expect(rotated?.replayDetected).toBe(false);

    const replay = await managerA.rotateRefreshToken(token);
    expect(replay?.replayDetected).toBe(true);
  });

  it("supports explicit invalidation for current session and all user sessions", async () => {
    const store = new InMemoryRefreshTokenStore();
    const manager = new SecureTokenManager({
      ...baseConfig,
      refreshTokenStore: store,
    });

    const sessionOne = await manager.issueRefreshToken({
      userId: "user-1",
      tenantId: "tenant-1",
      deviceId: "device-a",
    });

    const sessionTwo = await manager.issueRefreshToken({
      userId: "user-1",
      tenantId: "tenant-1",
      deviceId: "device-b",
    });

    await expect(manager.signOutCurrentSession(sessionOne)).resolves.toBe(true);

    const afterSignOutCurrent = await manager.rotateRefreshToken(sessionOne);
    expect(afterSignOutCurrent?.replayDetected).toBe(true);

    const revokedForDevice = await manager.signOutAllSessionsForUser(
      "user-1",
      "tenant-1",
      "device-b"
    );
    expect(revokedForDevice).toBe(1);

    const afterDeviceRevocation = await manager.rotateRefreshToken(sessionTwo);
    expect(afterDeviceRevocation?.replayDetected).toBe(true);
  });

  describe("seenJtis eviction", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("evicts expired JTIs so the map does not grow unboundedly", () => {
      // Issue a token that expires in 1 second
      const shortManager = new SecureTokenManager({
        secret: "test-secure-token-secret",
        issuer: "valueos.tests",
        audience: "valueos.test-clients",
        expiresIn: "1s",
      });

      const token = jwt.sign(
        { sub: "user-evict", jti: "evict-me" },
        "test-secure-token-secret",
        {
          algorithm: "HS256",
          issuer: "valueos.tests",
          audience: "valueos.test-clients",
          expiresIn: 1,
        },
      );

      // First verify — JTI is stored
      shortManager.verifyToken(token, { rejectReplay: true });

      // Advance past token expiry
      vi.advanceTimersByTime(2000);

      // Issue a fresh token with the same jti — the old entry should have been
      // pruned, so this is treated as a new (valid) first use.
      const freshToken = jwt.sign(
        { sub: "user-evict", jti: "evict-me" },
        "test-secure-token-secret",
        {
          algorithm: "HS256",
          issuer: "valueos.tests",
          audience: "valueos.test-clients",
          expiresIn: "1h",
        },
      );

      // The expired entry was pruned; the fresh token with the same jti is accepted.
      expect(shortManager.verifyToken(freshToken, { rejectReplay: true })).not.toBeNull();
    });
  });
});
