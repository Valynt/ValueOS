import { describe, expect, it } from "vitest";

import { AuthorizationError } from "../../bfa/types.js";
import { authorizationPolicyGateway } from "../AuthorizationPolicyGateway.js";

describe("AuthorizationPolicyGateway", () => {
  it("blocks side effects when validator denies access", () => {
    let sideEffectTriggered = false;

    expect(() => {
      authorizationPolicyGateway.authorize(
        {
          channel: "bfa_auth_guard",
          action: "execute",
          resource: "secure_tool",
          mode: "custom",
          policyVersion: "bfa-v1",
          subject: {
            userId: "user-1",
            tenantId: "tenant-1",
            sessionId: "session-1",
          },
        },
        () => {
          throw new AuthorizationError("Insufficient permissions", [
            "tool:execute:secure",
          ]);
        }
      );
      sideEffectTriggered = true;
    }).toThrow(AuthorizationError);

    expect(sideEffectTriggered).toBe(false);
  });
});
