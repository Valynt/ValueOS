export const RESOURCES = {
  DASHBOARD: "dashboard",
  PROJECTS: "projects",
  TEAM: "team",
  SETTINGS: "settings",
  BILLING: "billing",
  ADMIN: "admin",
  USERS: "users",
  API_KEYS: "api_keys",
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

export const ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
  MANAGE: "manage",
  INVITE: "invite",
  ALL: "*",
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

export type Permission = `${Resource}:${Action}`;

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

  ADMIN_ACCESS: "admin:view" as Permission,
  ADMIN_MANAGE: "admin:manage" as Permission,
} as const;

export function parsePermission(permission: string): { resource: string; action: string } | null {
  const parts = permission.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { resource: parts[0], action: parts[1] };
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
