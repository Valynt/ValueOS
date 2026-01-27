/**
 * Role Types and Constants
 */
import { Permission, PERMISSIONS } from "./types";

export const USER_ROLES = {
  ADMIN: "admin",
  MEMBER: "member",
  VIEWER: "viewer",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const AGENT_ROLES = {
  ORCHESTRATOR: "orchestrator",
  EXECUTOR: "executor",
  OBSERVER: "observer",
} as const;

export type AgentRole = (typeof AGENT_ROLES)[keyof typeof AGENT_ROLES];

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
    PERMISSIONS.VALUE_TREES_VIEW,
    PERMISSIONS.VALUE_TREES_CREATE,
    PERMISSIONS.VALUE_TREES_EDIT,
    PERMISSIONS.COMMITMENTS_VIEW,
    PERMISSIONS.COMMITMENTS_CREATE,
    PERMISSIONS.AGENTS_VIEW,
  ],

  [USER_ROLES.VIEWER]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PROJECTS_VIEW,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.VALUE_TREES_VIEW,
    PERMISSIONS.COMMITMENTS_VIEW,
  ],
};

export const AGENT_ROLE_PERMISSIONS: Record<AgentRole, Permission[]> = {
  [AGENT_ROLES.ORCHESTRATOR]: Object.values(PERMISSIONS),

  [AGENT_ROLES.EXECUTOR]: [
    PERMISSIONS.VALUE_TREES_VIEW,
    PERMISSIONS.VALUE_TREES_EDIT,
    PERMISSIONS.COMMITMENTS_VIEW,
    PERMISSIONS.COMMITMENTS_CREATE,
    PERMISSIONS.COMMITMENTS_EDIT,
    PERMISSIONS.AGENTS_EXECUTE,
  ],

  [AGENT_ROLES.OBSERVER]: [
    PERMISSIONS.VALUE_TREES_VIEW,
    PERMISSIONS.COMMITMENTS_VIEW,
    PERMISSIONS.AGENTS_VIEW,
  ],
};

export const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  owner: USER_ROLES.ADMIN,
  editor: USER_ROLES.MEMBER,
  reader: USER_ROLES.VIEWER,
};

export function getPermissionsForUserRole(role: string): Permission[] {
  return USER_ROLE_PERMISSIONS[role as UserRole] || [];
}

export function getPermissionsForAgentRole(role: string): Permission[] {
  return AGENT_ROLE_PERMISSIONS[role as AgentRole] || [];
}

export function computePermissionsFromRoles(
  userRoles: string[],
  agentRoles: string[] = []
): Permission[] {
  const permissions = new Set<Permission>();

  for (const role of userRoles) {
    for (const perm of getPermissionsForUserRole(role)) {
      permissions.add(perm);
    }
  }

  for (const role of agentRoles) {
    for (const perm of getPermissionsForAgentRole(role)) {
      permissions.add(perm);
    }
  }

  return Array.from(permissions);
}

export function isValidUserRole(role: string): role is UserRole {
  return Object.values(USER_ROLES).includes(role as UserRole);
}

export function isValidAgentRole(role: string): role is AgentRole {
  return Object.values(AGENT_ROLES).includes(role as AgentRole);
}

export function normalizeRole(role: string): UserRole | null {
  if (isValidUserRole(role)) return role;
  return LEGACY_ROLE_MAP[role] || null;
}

export function getRolesWithPermission(permission: Permission): UserRole[] {
  return (Object.entries(USER_ROLE_PERMISSIONS) as [UserRole, Permission[]][])
    .filter(([, perms]) => perms.includes(permission))
    .map(([role]) => role);
}
