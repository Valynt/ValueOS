/**
 * Unified Permissions Module
 * 
 * All permission types, constants, and utilities are exported from here.
 */

export {
  // Types
  type Permission,
  type Resource,
  type Action,
  
  // Constants
  PERMISSIONS,
  RESOURCES,
  ACTIONS,
  
  // Permission utilities
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  parsePermission,
  createPermission,
  matchesPermission,
  expandWildcard,
  isValidPermission,
} from "./types";

export {
  // Role types
  type UserRole,
  type AgentRole,
  
  // Role constants (USER_ROLES is exported from constants/index.ts to avoid duplication)
  AGENT_ROLES,
  USER_ROLE_PERMISSIONS,
  AGENT_ROLE_PERMISSIONS,
  LEGACY_ROLE_MAP,
  
  // Role utilities
  getPermissionsForUserRole,
  getPermissionsForAgentRole,
  computePermissionsFromRoles,
  isValidUserRole,
  isValidAgentRole,
  normalizeRole,
  getRolesWithPermission,
} from "./roles";
