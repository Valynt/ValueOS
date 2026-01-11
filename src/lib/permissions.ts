/**
 * Permission Constants and Utilities
 *
 * Defines RBAC permissions for the application.
 */

export const PERMISSIONS = {
  // Deals
  DEALS_VIEW: "deals:view",
  DEALS_CREATE: "deals:create",
  DEALS_EDIT: "deals:edit",
  DEALS_DELETE: "deals:delete",

  // Canvas
  CANVAS_VIEW: "canvas:view",
  CANVAS_EDIT: "canvas:edit",

  // Agents
  AGENTS_VIEW: "agents:view",
  AGENTS_EXECUTE: "agents:execute",
  AGENTS_CONFIGURE: "agents:configure",

  // Team
  TEAM_VIEW: "team:view",
  TEAM_INVITE: "team:invite",
  TEAM_MANAGE: "team:manage",

  // Settings
  SETTINGS_VIEW: "settings:view",
  SETTINGS_EDIT: "settings:edit",

  // Billing
  BILLING_VIEW: "billing:view",
  BILLING_MANAGE: "billing:manage",

  // Admin
  ADMIN_ACCESS: "admin:access",
  ADMIN_USERS: "admin:users",
  ADMIN_TENANTS: "admin:tenants",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Role-based permission mappings
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: Object.values(PERMISSIONS),
  manager: [
    PERMISSIONS.DEALS_VIEW,
    PERMISSIONS.DEALS_CREATE,
    PERMISSIONS.DEALS_EDIT,
    PERMISSIONS.CANVAS_VIEW,
    PERMISSIONS.CANVAS_EDIT,
    PERMISSIONS.AGENTS_VIEW,
    PERMISSIONS.AGENTS_EXECUTE,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_INVITE,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.BILLING_VIEW,
  ],
  member: [
    PERMISSIONS.DEALS_VIEW,
    PERMISSIONS.DEALS_CREATE,
    PERMISSIONS.CANVAS_VIEW,
    PERMISSIONS.CANVAS_EDIT,
    PERMISSIONS.AGENTS_VIEW,
    PERMISSIONS.AGENTS_EXECUTE,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
  ],
  viewer: [
    PERMISSIONS.DEALS_VIEW,
    PERMISSIONS.CANVAS_VIEW,
    PERMISSIONS.AGENTS_VIEW,
    PERMISSIONS.TEAM_VIEW,
  ],
};

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  userPermissions: string[] | undefined,
  requiredPermission: Permission
): boolean {
  if (!userPermissions) return false;
  return userPermissions.includes(requiredPermission);
}

/**
 * Check if a user has all required permissions
 */
export function hasAllPermissions(
  userPermissions: string[] | undefined,
  requiredPermissions: Permission[]
): boolean {
  if (!userPermissions) return false;
  return requiredPermissions.every((p) => userPermissions.includes(p));
}

/**
 * Check if a user has any of the required permissions
 */
export function hasAnyPermission(
  userPermissions: string[] | undefined,
  requiredPermissions: Permission[]
): boolean {
  if (!userPermissions) return false;
  return requiredPermissions.some((p) => userPermissions.includes(p));
}

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}
