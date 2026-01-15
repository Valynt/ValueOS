/**
 * Unified Permission Types
 *
 * Single source of truth for all permission definitions across ValueOS.
 * All layers (frontend, backend, agent, guest) import from this file.
 *
 * Format: `${Resource}:${Action}`
 * Examples: "deals:view", "agents:execute", "admin:system"
 */

// ============================================================================
// Resource Definitions
// ============================================================================

/**
 * All resources that can be protected by permissions
 */
export const RESOURCES = {
  // Core business resources
  DEALS: "deals",
  CANVAS: "canvas",
  AGENTS: "agents",
  TEAM: "team",
  SETTINGS: "settings",
  BILLING: "billing",

  // Data resources
  DATA: "data",
  CUSTOMERS: "customers",
  BENCHMARKS: "benchmarks",
  VMRT: "vmrt",
  WORKFLOWS: "workflows",

  // Administrative resources
  ADMIN: "admin",
  USERS: "users",
  ROLES: "roles",
  PERMISSIONS: "permissions",
  TENANTS: "tenants",
  API_KEYS: "api_keys",
  AUDIT: "audit",
  SECRETS: "secrets",

  // System resources
  SYSTEM: "system",
  SECURITY: "security",
  CRM: "crm",
  EXTERNAL_API: "external_api",
  LLM: "llm",
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

// ============================================================================
// Action Definitions
// ============================================================================

/**
 * All actions that can be performed on resources
 */
export const ACTIONS = {
  // Read operations
  VIEW: "view",
  READ: "read",
  LIST: "list",
  EXPORT: "export",

  // Write operations
  CREATE: "create",
  EDIT: "edit",
  UPDATE: "update",
  DELETE: "delete",
  IMPORT: "import",
  WRITE: "write",

  // Management operations
  MANAGE: "manage",
  CONFIGURE: "configure",
  INVITE: "invite",
  ASSIGN: "assign",
  GRANT: "grant",
  REVOKE: "revoke",
  ROTATE: "rotate",
  PROVISION: "provision",

  // Execution operations
  EXECUTE: "execute",
  ACCESS: "access",

  // Wildcard
  ALL: "*",
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

// ============================================================================
// Permission Type
// ============================================================================

/**
 * Unified permission format: `resource:action`
 *
 * Examples:
 * - "deals:view" - Can view deals
 * - "agents:execute" - Can execute agents
 * - "admin:*" - All admin permissions (wildcard)
 */
export type Permission = `${Resource}:${Action}`;

// ============================================================================
// Permission Constants
// ============================================================================

/**
 * All defined permissions in the system
 * Organized by resource for easy discovery
 */
export const PERMISSIONS = {
  // Deals
  DEALS_VIEW: "deals:view" as Permission,
  DEALS_CREATE: "deals:create" as Permission,
  DEALS_EDIT: "deals:edit" as Permission,
  DEALS_DELETE: "deals:delete" as Permission,

  // Canvas
  CANVAS_VIEW: "canvas:view" as Permission,
  CANVAS_EDIT: "canvas:edit" as Permission,

  // Agents
  AGENTS_VIEW: "agents:view" as Permission,
  AGENTS_EXECUTE: "agents:execute" as Permission,
  AGENTS_CONFIGURE: "agents:configure" as Permission,

  // Team
  TEAM_VIEW: "team:view" as Permission,
  TEAM_INVITE: "team:invite" as Permission,
  TEAM_MANAGE: "team:manage" as Permission,

  // Settings
  SETTINGS_VIEW: "settings:view" as Permission,
  SETTINGS_EDIT: "settings:edit" as Permission,

  // Billing
  BILLING_VIEW: "billing:view" as Permission,
  BILLING_MANAGE: "billing:manage" as Permission,

  // Data operations
  DATA_READ: "data:read" as Permission,
  DATA_CREATE: "data:create" as Permission,
  DATA_UPDATE: "data:update" as Permission,
  DATA_DELETE: "data:delete" as Permission,
  DATA_EXPORT: "data:export" as Permission,
  DATA_IMPORT: "data:import" as Permission,

  // Customers
  CUSTOMERS_READ: "customers:read" as Permission,
  CUSTOMERS_WRITE: "customers:write" as Permission,

  // Benchmarks
  BENCHMARKS_READ: "benchmarks:read" as Permission,
  BENCHMARKS_WRITE: "benchmarks:write" as Permission,

  // VMRT (Value Mapping & Realization Tracking)
  VMRT_READ: "vmrt:read" as Permission,
  VMRT_WRITE: "vmrt:write" as Permission,

  // Workflows
  WORKFLOWS_READ: "workflows:read" as Permission,
  WORKFLOWS_WRITE: "workflows:write" as Permission,
  WORKFLOWS_EXECUTE: "workflows:execute" as Permission,

  // Users
  USERS_READ: "users:read" as Permission,
  USERS_CREATE: "users:create" as Permission,
  USERS_UPDATE: "users:update" as Permission,
  USERS_DELETE: "users:delete" as Permission,
  USERS_INVITE: "users:invite" as Permission,

  // Roles
  ROLES_READ: "roles:read" as Permission,
  ROLES_CREATE: "roles:create" as Permission,
  ROLES_UPDATE: "roles:update" as Permission,
  ROLES_DELETE: "roles:delete" as Permission,
  ROLES_ASSIGN: "roles:assign" as Permission,

  // Permissions management
  PERMISSIONS_READ: "permissions:read" as Permission,
  PERMISSIONS_GRANT: "permissions:grant" as Permission,
  PERMISSIONS_REVOKE: "permissions:revoke" as Permission,

  // Tenants
  TENANTS_READ: "tenants:read" as Permission,
  TENANTS_CREATE: "tenants:create" as Permission,
  TENANTS_UPDATE: "tenants:update" as Permission,
  TENANTS_DELETE: "tenants:delete" as Permission,
  TENANTS_PROVISION: "tenants:provision" as Permission,

  // API Keys
  API_KEYS_READ: "api_keys:read" as Permission,
  API_KEYS_CREATE: "api_keys:create" as Permission,
  API_KEYS_ROTATE: "api_keys:rotate" as Permission,
  API_KEYS_REVOKE: "api_keys:revoke" as Permission,

  // Audit
  AUDIT_READ: "audit:read" as Permission,
  AUDIT_EXPORT: "audit:export" as Permission,

  // Secrets
  SECRETS_READ: "secrets:read" as Permission,
  SECRETS_LIST: "secrets:list" as Permission,
  SECRETS_WRITE: "secrets:write" as Permission,
  SECRETS_ROTATE: "secrets:rotate" as Permission,
  SECRETS_DELETE: "secrets:delete" as Permission,

  // Admin
  ADMIN_ACCESS: "admin:access" as Permission,
  ADMIN_USERS: "admin:manage" as Permission,
  ADMIN_SYSTEM: "admin:*" as Permission,

  // System
  SYSTEM_ACCESS: "system:access" as Permission,
  SYSTEM_CONFIGURE: "system:configure" as Permission,

  // Security
  SECURITY_MANAGE: "security:manage" as Permission,

  // CRM
  CRM_READ: "crm:read" as Permission,
  CRM_WRITE: "crm:write" as Permission,

  // External API
  EXTERNAL_API_EXECUTE: "external_api:execute" as Permission,

  // LLM
  LLM_EXECUTE: "llm:execute" as Permission,
} as const;

// ============================================================================
// Permission Utilities
// ============================================================================

/**
 * Parse a permission string into resource and action
 */
export function parsePermission(
  permission: string
): { resource: string; action: string } | null {
  const parts = permission.split(":");
  if (parts.length !== 2) return null;
  return { resource: parts[0], action: parts[1] };
}

/**
 * Create a permission string from resource and action
 */
export function createPermission(
  resource: Resource,
  action: Action
): Permission {
  return `${resource}:${action}` as Permission;
}

/**
 * Check if a permission matches another (supports wildcards)
 *
 * Examples:
 * - matchesPermission("admin:*", "admin:users") => true
 * - matchesPermission("deals:view", "deals:view") => true
 * - matchesPermission("deals:view", "deals:edit") => false
 */
export function matchesPermission(granted: string, required: string): boolean {
  if (granted === required) return true;

  const grantedParts = parsePermission(granted);
  const requiredParts = parsePermission(required);

  if (!grantedParts || !requiredParts) return false;

  // Check resource match
  if (
    grantedParts.resource !== requiredParts.resource &&
    grantedParts.resource !== "*"
  ) {
    return false;
  }

  // Check action match (wildcard support)
  if (grantedParts.action === "*") return true;

  return grantedParts.action === requiredParts.action;
}

/**
 * Check if user has a specific permission (supports wildcards)
 */
export function hasPermission(
  userPermissions: string[] | undefined,
  requiredPermission: Permission
): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;

  return userPermissions.some((granted) =>
    matchesPermission(granted, requiredPermission)
  );
}

/**
 * Check if user has all required permissions
 */
export function hasAllPermissions(
  userPermissions: string[] | undefined,
  requiredPermissions: Permission[]
): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  if (requiredPermissions.length === 0) return true;

  return requiredPermissions.every((required) =>
    hasPermission(userPermissions, required)
  );
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(
  userPermissions: string[] | undefined,
  requiredPermissions: Permission[]
): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  if (requiredPermissions.length === 0) return true;

  return requiredPermissions.some((required) =>
    hasPermission(userPermissions, required)
  );
}

/**
 * Expand wildcard permissions to explicit permissions
 *
 * Example: expandWildcard("admin:*") => ["admin:access", "admin:manage", ...]
 */
export function expandWildcard(permission: string): Permission[] {
  const parsed = parsePermission(permission);
  if (!parsed || parsed.action !== "*") {
    return [permission as Permission];
  }

  // Find all permissions for this resource
  return Object.values(PERMISSIONS).filter((p) => {
    const pParsed = parsePermission(p);
    return pParsed && pParsed.resource === parsed.resource;
  });
}

/**
 * Validate that a string is a valid permission format
 */
export function isValidPermission(
  permission: string
): permission is Permission {
  const parsed = parsePermission(permission);
  if (!parsed) return false;

  const validResources = Object.values(RESOURCES) as string[];
  const validActions = Object.values(ACTIONS) as string[];

  return (
    validResources.includes(parsed.resource) &&
    validActions.includes(parsed.action)
  );
}
