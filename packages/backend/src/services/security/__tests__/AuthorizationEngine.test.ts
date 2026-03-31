import { describe, expect, it } from "vitest";

import { AuthorizationEngine } from "../AuthorizationEngine.js";
import type { Permission, Role, SecurityContext, SecurityPolicy } from "../AgentSecurityTypes.js";

// Constructor accepts arrays, not Maps
const permissions: Permission[] = [
  {
    id: "agent_write",
    name: "Agent write",
    description: "write access",
    resource: "agent/*",
    action: "write",
    riskLevel: "medium",
    auditRequired: true,
    mfaRequired: false,
    conditions: [
      { type: "device", operator: "equals", value: "managed" },
    ],
  },
];
const roles: Role[] = [
  {
    id: "agent",
    name: "Agent",
    description: "base role",
    permissions: ["agent_write"],
    priority: 1,
    systemRole: true,
    createdAt: 1,
    updatedAt: 1,
  },
];
const policies: SecurityPolicy[] = [
  {
    id: "deny_policy",
    name: "Deny risky writes",
    description: "deny policy",
    type: "access_control",
    rules: [
      {
        id: "deny_rule",
        name: "deny all",
        description: "test rule",
        condition: { expression: "true" },
        action: { type: "deny" },
        severity: "critical",
        enabled: true,
      },
    ],
    enabled: true,
    priority: 1,
    conditions: [],
    actions: [],
    complianceFrameworks: ["SOC2"],
  },
];

const context: SecurityContext = {
  tenantId: "tenant-1",
  userId: "user-1",
  agentId: "agent-1",
  sessionId: "session-1",
  permissions: [],
  roles: ["agent"],
  authenticationMethod: {
    type: "api_key",
    credentials: { apiKey: "ak_12345678901234567890123456789" },
    mfaRequired: false,
  },
  trustLevel: "medium",
  timestamp: Date.now(),
};

describe("AuthorizationEngine", () => {
  it("grants permissions through role inheritance when conditions match", async () => {
    const engine = new AuthorizationEngine({ permissions, roles, policies: [] });

    const result = await engine.checkPermissions(context, "write", "agent/123", {
      device: "managed",
    });

    expect(result).toEqual({
      granted: true,
      reason: "Permission granted via role: agent",
    });
  });

  it("denies requests when an enabled deny rule is encountered", async () => {
    const engine = new AuthorizationEngine({ permissions, roles, policies });

    const result = await engine.applySecurityPolicies(context, "write", "agent/123", {
      device: "managed",
    });

    expect(result).toMatchObject({
      allowed: false,
      reason: "Policy violation: deny all",
    });
  });
});
