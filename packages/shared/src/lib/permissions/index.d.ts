/**
 * Unified Permissions Module
 *
 * All permission types, constants, and utilities are exported from here.
 */
export { type Permission, type Resource, type Action, PERMISSIONS, RESOURCES, ACTIONS, hasPermission, hasAllPermissions, hasAnyPermission, parsePermission, createPermission, matchesPermission, expandWildcard, isValidPermission, } from "./types";
export { type UserRole, type AgentRole, AGENT_ROLES, USER_ROLE_PERMISSIONS, AGENT_ROLE_PERMISSIONS, LEGACY_ROLE_MAP, getPermissionsForUserRole, getPermissionsForAgentRole, computePermissionsFromRoles, isValidUserRole, isValidAgentRole, normalizeRole, getRolesWithPermission, } from "./roles";
//# sourceMappingURL=index.d.ts.map