/**
 * Permission Constants and Utilities
 *
 * @deprecated Import from '@/lib/permissions' (the permissions/ directory) instead.
 * This file is maintained for backward compatibility only.
 *
 * All new code should import from:
 * import { Permission, PERMISSIONS, hasPermission } from '@/lib/permissions';
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
  USER_ROLES,
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

// Backward compatibility aliases
import {
  USER_ROLE_PERMISSIONS,
  getPermissionsForUserRole,
} from "./permissions/index";

/**
 * @deprecated Use USER_ROLE_PERMISSIONS instead
 */
export const ROLE_PERMISSIONS = USER_ROLE_PERMISSIONS;

/**
 * @deprecated Use getPermissionsForUserRole instead
 */
export function getPermissionsForRole(role: string) {
  return getPermissionsForUserRole(role);
}
