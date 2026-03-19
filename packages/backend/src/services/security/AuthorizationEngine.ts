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
  constructor(private readonly dependencies: AuthorizationEngineDependencies) {}

  async checkPermissions(
    context: SecurityContext,
    action: string,
    resource: string,
    requestContext?: RequestMetadata
  ): Promise<PermissionCheckResult> {
    for (const permissionName of context.permissions) {
      const permission = this.dependencies.permissions.get(permissionName);

      if (permission && this.matchesPermission(permission, action, resource, requestContext)) {
        return { granted: true, reason: "Permission granted" };
      }
    }

    for (const roleName of context.roles) {
      const role = this.dependencies.roles.get(roleName);

      if (!role) continue;

      for (const permissionName of role.permissions) {
        const permission = this.dependencies.permissions.get(permissionName);

        if (permission && this.matchesPermission(permission, action, resource, requestContext)) {
          return { granted: true, reason: `Permission granted via role: ${roleName}` };
        }
      }
    }

    return { granted: false, reason: "Insufficient permissions" };
  }

  matchesPermission(
    permission: Permission,
    action: string,
    resource: string,
    context?: RequestMetadata
  ): boolean {
    if (permission.action !== "*" && permission.action !== action) {
      return false;
    }

    if (
      permission.resource !== "*" &&
      // eslint-disable-next-line security/detect-non-literal-regexp -- permission patterns are service-controlled
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
    context?: RequestMetadata
  ): boolean {
    if (!context) return true;

    const allowedKeys = Object.keys(context);
    const value = safeRecordGet(context, condition.type, allowedKeys);

    switch (condition.operator) {
      case "equals":
        return value === condition.value;
      case "not_equals":
        return value !== condition.value;
      case "contains":
        return typeof value === "string" && typeof condition.value === "string" && value.includes(condition.value);
      case "not_contains":
        return typeof value === "string" && typeof condition.value === "string" && !value.includes(condition.value);
      case "greater_than":
        return Number(value) > Number(condition.value);
      case "less_than":
        return Number(value) < Number(condition.value);
      case "in":
        return Array.isArray(condition.value) && condition.value.includes(value);
      case "not_in":
        return Array.isArray(condition.value) && !condition.value.includes(value);
      default:
        return true;
    }
  }

  async applySecurityPolicies(
    context: SecurityContext,
    action: string,
    resource: string,
    requestContext?: RequestMetadata
  ): Promise<PolicyCheckResult> {
    for (const policy of this.dependencies.policies.values()) {
      if (!policy.enabled) continue;

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

  async evaluatePolicy(
    policy: SecurityPolicy,
    _context: SecurityContext,
    _action: string,
    _resource: string,
    _requestContext?: RequestMetadata
  ): Promise<PolicyCheckResult> {
    for (const rule of policy.rules) {
      if (!rule.enabled) continue;

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
