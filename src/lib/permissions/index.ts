/**
 * Unified Permissions Module
 *
 * Central export point for all permission-related types and utilities.
 * Import from this module for consistent permission handling across the codebase.
 *
 * @example
 * import { Permission, PERMISSIONS, hasPermission, getPermissionsForUserRole } from '@/lib/permissions';
 */

// Types (must use 'export type' for isolatedModules)
export type { Resource, Action, Permission } from "./types";

// Constants and utility functions
export {
  RESOURCES,
  ACTIONS,
  PERMISSIONS,
  parsePermission,
  createPermission,
  matchesPermission,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  expandWildcard,
  isValidPermission,
} from "./types";

// Role types (must use 'export type' for isolatedModules)
export type { UserRole, AgentRole } from "./roles";

// Role constants and utility functions
export {
  USER_ROLES,
  LEGACY_ROLE_MAP,
  USER_ROLE_PERMISSIONS,
  AGENT_ROLES,
  AGENT_ROLE_PERMISSIONS,
  getPermissionsForUserRole,
  getPermissionsForAgentRole,
  computePermissionsFromRoles,
  isValidUserRole,
  isValidAgentRole,
  normalizeRole,
  getRolesWithPermission,
} from "./roles";
