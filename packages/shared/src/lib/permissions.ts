/**
 * Permission Constants and Utilities
 *
 * Re-exports from the permissions/ directory for convenience.
 */

// Re-export everything from the unified permissions module
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

  // Role types and constants
  type UserRole,
  type AgentRole,
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
} from "./permissions/index";
