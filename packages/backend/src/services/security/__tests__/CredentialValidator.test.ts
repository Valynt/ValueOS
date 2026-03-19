import { describe, expect, it } from "vitest";

import { CredentialValidator } from "../CredentialValidator.js";

const validator = new CredentialValidator({ mfaRequiredForPrivileged: true });

describe("CredentialValidator", () => {
  it("validates API keys and derives agent identity", async () => {
    const result = await validator.validateApiKey("ak_12345678901234567890123456789", "alpha");

    expect(result).toMatchObject({
      valid: true,
      subject: "agent_alpha",
      roles: ["agent"],
    });
  });

  it("rejects malformed JWTs and elevates internal network trust for agents", async () => {
    const badJwt = await validator.validateJWT("bad-token");
    const trust = validator.calculateTrustLevel(
      { valid: true, roles: ["agent"] },
      { ipAddress: "10.0.0.8" }
    );

    expect(badJwt).toEqual({ valid: false, reason: "Invalid JWT format" });
    expect(trust).toBe("high");
  });

  it("requires MFA for privileged certificate-based roles", async () => {
    const needsMfa = validator.isMFARequired(["certified_agent"]);

    expect(needsMfa).toBe(true);
  });
});
