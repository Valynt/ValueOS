import { Permission, PERMISSIONS } from "./types";

export const USER_ROLES = {
  ADMIN: "admin",
  MEMBER: "member",
  VIEWER: "viewer",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [USER_ROLES.ADMIN]: Object.values(PERMISSIONS),

  [USER_ROLES.MEMBER]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PROJECTS_VIEW,
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.PROJECTS_EDIT,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.USERS_VIEW,
  ],

  [USER_ROLES.VIEWER]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PROJECTS_VIEW,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
  ],
};

export function getPermissionsForRole(role: string): Permission[] {
  return USER_ROLE_PERMISSIONS[role as UserRole] || [];
}

export function isValidRole(role: string): role is UserRole {
  return Object.values(USER_ROLES).includes(role as UserRole);
}

export function getRolesWithPermission(permission: Permission): UserRole[] {
  return (Object.entries(USER_ROLE_PERMISSIONS) as [UserRole, Permission[]][])
    .filter(([, perms]) => perms.includes(permission))
    .map(([role]) => role);
}
