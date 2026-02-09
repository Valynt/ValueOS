/**
 * Permission Constants and Utilities
 *
 * @deprecated Import from '@/lib/permissions' (the permissions/ directory) instead.
 * This file is maintained for backward compatibility only.
 *
 * All new code should import from:
 * import { Permission, PERMISSIONS, hasPermission } from '@/lib/permissions';
 */
export { type Permission, type Resource, type Action, PERMISSIONS, RESOURCES, ACTIONS, hasPermission, hasAllPermissions, hasAnyPermission, parsePermission, createPermission, matchesPermission, expandWildcard, isValidPermission, type UserRole, type AgentRole, AGENT_ROLES, USER_ROLE_PERMISSIONS, AGENT_ROLE_PERMISSIONS, LEGACY_ROLE_MAP, getPermissionsForUserRole, getPermissionsForAgentRole, computePermissionsFromRoles, isValidUserRole, isValidAgentRole, normalizeRole, getRolesWithPermission, } from "./permissions/index";
/**
 * @deprecated Use USER_ROLE_PERMISSIONS instead
 */
export declare const ROLE_PERMISSIONS: Record<import("./permissions").UserRole, `${string}:${string}`[]>;
/**
 * @deprecated Use getPermissionsForUserRole instead
 */
export declare function getPermissionsForRole(role: string): `${string}:${string}`[];
//# sourceMappingURL=permissions.d.ts.map