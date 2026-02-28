import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import { SecureTokenManager } from "./SecureTokenManager";

describe("SecureTokenManager", () => {
  const manager = new SecureTokenManager({
    secret: "test-secure-token-secret",
    issuer: "valueos.tests",
    audience: "valueos.test-clients",
    expiresIn: "1h",
  });

  it("rejects tampered tokens", () => {
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
});
