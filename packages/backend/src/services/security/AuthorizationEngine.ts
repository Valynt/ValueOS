import { safeRecordGet } from "../../utils/safePropertyAccess.js";

import type {
  Permission,
  PermissionCheckResult,
  PermissionCondition,
  PolicyCheckResult,
  RequestMetadata,
  Role,
  SecurityContext,
  SecurityPolicy,
} from "./AgentSecurityTypes.js";

export interface AuthorizationEngineDependencies {
  permissions: ReadonlyMap<string, Permission>;
  roles: ReadonlyMap<string, Role>;
  policies: ReadonlyMap<string, SecurityPolicy>;
}

export class AuthorizationEngine {
  private readonly permissions: Map<string, Permission>;
  private readonly roles: Map<string, Role>;
  private readonly policies: Map<string, SecurityPolicy>;

  constructor(options: {
    dependencies?: AuthorizationEngineDependencies;
    permissions?: Permission[];
    roles?: Role[];
    policies?: SecurityPolicy[];
  } = {}) {
    if (options.dependencies) {
      this.permissions = new Map(options.dependencies.permissions);
      this.roles = new Map(options.dependencies.roles);
      this.policies = new Map(options.dependencies.policies);
    } else {
      this.permissions = new Map();
      for (const permission of options.permissions ?? createDefaultPermissions()) {
        this.permissions.set(permission.id, permission);
      }

      this.roles = new Map();
      for (const role of options.roles ?? createDefaultRoles()) {
        this.roles.set(role.id, role);
      }

      this.policies = new Map();
      for (const policy of options.policies ?? createDefaultPolicies()) {
        this.policies.set(policy.id, policy);
      }
    }
  }

  checkPermissions(
    context: SecurityContext,
    action: string,
    resource: string,
    requestContext?: RequestMetadata | Record<string, unknown>
  ): PermissionCheckResult {
    for (const permissionName of context.permissions) {
      const permission = this.permissions.get(permissionName);

      if (permission && this.matchesPermission(permission, action, resource, requestContext)) {
        return { granted: true, reason: "Permission granted" };
      }
    }

    for (const roleName of context.roles) {
      const role = this.roles.get(roleName);
      if (!role) {
        continue;
      }

      for (const permissionName of role.permissions) {
        const permission = this.permissions.get(permissionName);
        if (permission && this.matchesPermission(permission, action, resource, requestContext)) {
          return { granted: true, reason: `Permission granted via role: ${roleName}` };
        }
      }
    }

    return { granted: false, reason: "Insufficient permissions" };
  }

  async applySecurityPolicies(
    context: SecurityContext,
    action: string,
    resource: string,
    requestContext?: Record<string, unknown>
  ): Promise<PolicyCheckResult> {
    for (const policy of this.policies.values()) {
      if (!policy.enabled) {
        continue;
      }

      const policyResult = await this.evaluatePolicy(
        policy,
        context,
        action,
        resource,
        requestContext
      );

      if (!policyResult.allowed) {
        return policyResult;
      }
    }

    return { allowed: true, reason: "All policies passed", conditions: [], requiresMFA: false };
  }

  matchesPermission(
    permission: Permission,
    action: string,
    resource: string,
    context?: RequestMetadata | Record<string, unknown>
  ): boolean {
    if (permission.action !== "*" && permission.action !== action) {
      return false;
    }

    if (
      permission.resource !== "*" &&
      // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is validated/controlled
      !resource.match(new RegExp(permission.resource.replace("*", ".*")))
    ) {
      return false;
    }

    if (permission.conditions) {
      for (const condition of permission.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          return false;
        }
      }
    }

    return true;
  }

  evaluateCondition(
    condition: PermissionCondition,
    context?: RequestMetadata | Record<string, unknown>
  ): boolean {
    if (!context) {
      return true;
    }

    const allowedKeys = Object.keys(context);
    const value = safeRecordGet(context, condition.type, allowedKeys);

    let result = true;
    switch (condition.operator) {
      case "equals":
        result = value === condition.value;
        break;
      case "not_equals":
        result = value !== condition.value;
        break;
      case "contains":
        result = typeof value === "string" && typeof condition.value === "string" && value.includes(condition.value);
        break;
      case "not_contains":
        result = typeof value === "string" && typeof condition.value === "string" && !value.includes(condition.value);
        break;
      case "greater_than":
        result = Number(value) > Number(condition.value);
        break;
      case "less_than":
        result = Number(value) < Number(condition.value);
        break;
      case "in":
        result = Array.isArray(condition.value) && condition.value.includes(value);
        break;
      case "not_in":
        result = Array.isArray(condition.value) && !condition.value.includes(value);
        break;
      default:
        result = true;
    }

    return condition.negate ? !result : result;
  }

  async evaluatePolicy(
    policy: SecurityPolicy,
    _context: SecurityContext,
    _action: string,
    _resource: string,
    _requestContext?: Record<string, unknown>
  ): Promise<PolicyCheckResult> {
    for (const rule of policy.rules) {
      if (!rule.enabled) {
        continue;
      }

      if (rule.action.type === "deny") {
        return {
          allowed: false,
          reason: `Policy violation: ${rule.name}`,
          conditions: [],
          requiresMFA: false,
        };
      }
    }

    return { allowed: true, reason: "All policies passed", conditions: [], requiresMFA: false };
  }
}

export function createDefaultPermissions(): Permission[] {
  return [
    {
      id: "agent_read",
      name: "Agent Read Access",
      description: "Read access to agent resources",
      resource: "agent/*",
      action: "read",
      riskLevel: "low",
      auditRequired: false,
      mfaRequired: false,
    },
    {
      id: "agent_write",
      name: "Agent Write Access",
      description: "Write access to agent resources",
      resource: "agent/*",
      action: "write",
      riskLevel: "medium",
      auditRequired: true,
      mfaRequired: false,
    },
    {
      id: "agent_admin",
      name: "Agent Administration",
      description: "Full administrative access to agents",
      resource: "agent/*",
      action: "*",
      riskLevel: "high",
      auditRequired: true,
      mfaRequired: true,
    },
  ];
}

export function createDefaultRoles(now = Date.now()): Role[] {
  return [
    {
      id: "agent",
      name: "Agent",
      description: "Basic agent role",
      permissions: ["agent_read", "agent_write"],
      priority: 1,
      systemRole: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "admin",
      name: "Administrator",
      description: "System administrator",
      permissions: ["agent_read", "agent_write", "agent_admin"],
      priority: 10,
      systemRole: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function createDefaultPolicies(): SecurityPolicy[] {
  return [
    {
      id: "session_policy",
      name: "Session Management Policy",
      description: "Controls session duration and validation",
      type: "access_control",
      rules: [],
      enabled: true,
      priority: 1,
      conditions: [],
      actions: [],
      complianceFrameworks: ["SOC2", "ISO27001"],
    },
  ];
}
