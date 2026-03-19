/**
 * Permission Types and Constants
 */

export const RESOURCES = {
  DASHBOARD: "dashboard",
  PROJECTS: "projects",
  TEAM: "team",
  SETTINGS: "settings",
  BILLING: "billing",
  ADMIN: "admin",
  USERS: "users",
  API_KEYS: "api_keys",
  INTEGRATIONS: "integrations",
  VALUE_TREES: "value_trees",
  COMMITMENTS: "commitments",
  AGENTS: "agents",
  APPROVALS: "approvals",
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

export const ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
  MANAGE: "manage",
  INVITE: "invite",
  EXECUTE: "execute",
  ALL: "*",
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

export type Permission = `${Resource}:${Action}` | `${string}:${string}` | `${string}.${string}`;

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view" as Permission,

  PROJECTS_VIEW: "projects:view" as Permission,
  PROJECTS_CREATE: "projects:create" as Permission,
  PROJECTS_EDIT: "projects:edit" as Permission,
  PROJECTS_DELETE: "projects:delete" as Permission,

  TEAM_VIEW: "team:view" as Permission,
  TEAM_INVITE: "team:invite" as Permission,
  TEAM_MANAGE: "team:manage" as Permission,

  SETTINGS_VIEW: "settings:view" as Permission,
  SETTINGS_EDIT: "settings:edit" as Permission,

  BILLING_VIEW: "billing:view" as Permission,
  BILLING_MANAGE: "billing:manage" as Permission,

  USERS_VIEW: "users:view" as Permission,
  USERS_CREATE: "users:create" as Permission,
  USERS_EDIT: "users:edit" as Permission,
  USERS_DELETE: "users:delete" as Permission,

  API_KEYS_VIEW: "api_keys:view" as Permission,
  API_KEYS_CREATE: "api_keys:create" as Permission,
  API_KEYS_DELETE: "api_keys:delete" as Permission,

  INTEGRATIONS_VIEW: "integrations:view" as Permission,
  INTEGRATIONS_MANAGE: "integrations:manage" as Permission,

  ADMIN_ACCESS: "admin:view" as Permission,
  ADMIN_MANAGE: "admin:manage" as Permission,

  VALUE_TREES_VIEW: "value_trees:view" as Permission,
  VALUE_TREES_CREATE: "value_trees:create" as Permission,
  VALUE_TREES_EDIT: "value_trees:edit" as Permission,
  VALUE_TREES_DELETE: "value_trees:delete" as Permission,

  COMMITMENTS_VIEW: "commitments:view" as Permission,
  COMMITMENTS_CREATE: "commitments:create" as Permission,
  COMMITMENTS_EDIT: "commitments:edit" as Permission,

  AGENTS_VIEW: "agents:view" as Permission,
  AGENTS_CREATE: "agents:create" as Permission,
  AGENTS_EXECUTE: "agents:execute" as Permission,

  APPROVALS_VIEW: "approvals:view" as Permission,
  APPROVALS_CREATE: "approvals:create" as Permission,
  APPROVALS_MANAGE: "approvals:manage" as Permission,

  AUDIT_READ: "audit.read" as Permission,
  COMPLIANCE_READ: "compliance.read" as Permission,
  TENANT_CONTEXT_READ: "tenant:context:read" as Permission,
  TENANT_CONTEXT_WRITE: "tenant:context:write" as Permission,

  // Tenant ownership transfer — restricted to the current owner only.
  OWNER_TRANSFER: "owner.transfer" as Permission,
} as const;

export function parsePermission(permission: string): { resource: string; action: string } | null {
  const parts = permission.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { resource: parts[0], action: parts[1] };
}

export function createPermission(resource: string, action: string): Permission {
  return `${resource}:${action}` as Permission;
}

export function matchesPermission(granted: string, required: string): boolean {
  if (granted === required) return true;

  const grantedParts = parsePermission(granted);
  const requiredParts = parsePermission(required);

  if (!grantedParts || !requiredParts) return false;

  if (grantedParts.resource !== requiredParts.resource && grantedParts.resource !== "*") {
    return false;
  }

  if (grantedParts.action === "*") return true;

  return grantedParts.action === requiredParts.action;
}

export function expandWildcard(permission: Permission): Permission[] {
  const parsed = parsePermission(permission);
  if (!parsed) return [permission];
  
  if (parsed.action === "*") {
    return Object.values(ACTIONS)
      .filter(a => a !== "*")
      .map(a => createPermission(parsed.resource, a));
  }
  
  return [permission];
}

export function isValidPermission(permission: string): permission is Permission {
  const parsed = parsePermission(permission);
  if (!parsed) return false;
  return true;
}

export function hasPermission(userPermissions: string[] | undefined, required: Permission): boolean {
  if (!userPermissions?.length) return false;
  return userPermissions.some((granted) => matchesPermission(granted, required));
}

export function hasAllPermissions(userPermissions: string[] | undefined, required: Permission[]): boolean {
  if (!userPermissions?.length) return false;
  if (!required.length) return true;
  return required.every((r) => hasPermission(userPermissions, r));
}

export function hasAnyPermission(userPermissions: string[] | undefined, required: Permission[]): boolean {
  if (!userPermissions?.length) return false;
  if (!required.length) return true;
  return required.some((r) => hasPermission(userPermissions, r));
}
