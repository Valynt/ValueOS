/**
 * Centralized Role-Permission Matrix
 *
 * Single source of truth for all role-based permission mappings.
 * All layers (frontend, backend, agent, guest) import from this file.
 */

import { Permission, PERMISSIONS } from "./types";

// ============================================================================
// Role Definitions
// ============================================================================

/**
 * System roles for users
 */
export const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MANAGER: "manager",
  MEMBER: "member",
  VIEWER: "viewer",
  GUEST: "guest",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/**
 * Legacy role names (for backward compatibility)
 * Maps old role names to new unified roles
 */
export const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  // From security.ts
  CFO: USER_ROLES.MANAGER,
  ADMIN: USER_ROLES.ADMIN,
  DEVELOPER: USER_ROLES.MEMBER,
  ANALYST: USER_ROLES.MEMBER,
  AGENT: USER_ROLES.MEMBER,
  // From permissions.ts
  admin: USER_ROLES.ADMIN,
  manager: USER_ROLES.MANAGER,
  member: USER_ROLES.MEMBER,
  viewer: USER_ROLES.VIEWER,
  // From rbac.ts
  owner: USER_ROLES.SUPER_ADMIN,
};

/**
 * Agent roles for the 7-Agent Taxonomy
 */
export const AGENT_ROLES = {
  COORDINATOR: "CoordinatorAgent",
  OPPORTUNITY: "OpportunityAgent",
  TARGET: "TargetAgent",
  REALIZATION: "RealizationAgent",
  EXPANSION: "ExpansionAgent",
  INTEGRITY: "IntegrityAgent",
  COMMUNICATOR: "CommunicatorAgent",
  BENCHMARK: "BenchmarkAgent",
  NARRATIVE: "NarrativeAgent",
  ADVERSARIAL: "AdversarialReasoningAgent",
  FINANCIAL_MODELING: "FinancialModelingAgent",
  COMPANY_INTELLIGENCE: "CompanyIntelligenceAgent",
  VALUE_MAPPING: "ValueMappingAgent",
  RESEARCH: "ResearchAgent",
  SYSTEM: "SystemAgent",
} as const;

export type AgentRole = (typeof AGENT_ROLES)[keyof typeof AGENT_ROLES];

// ============================================================================
// User Role-Permission Matrix
// ============================================================================

/**
 * Permissions granted to each user role
 * Implements deny-by-default - only explicitly listed permissions are granted
 */
export const USER_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [USER_ROLES.SUPER_ADMIN]: [
    // All permissions
    ...Object.values(PERMISSIONS),
  ],

  [USER_ROLES.ADMIN]: [
    // Data operations
    PERMISSIONS.DATA_READ,
    PERMISSIONS.DATA_CREATE,
    PERMISSIONS.DATA_UPDATE,
    PERMISSIONS.DATA_DELETE,
    PERMISSIONS.DATA_EXPORT,
    PERMISSIONS.DATA_IMPORT,
    // Deals
    PERMISSIONS.DEALS_VIEW,
    PERMISSIONS.DEALS_CREATE,
    PERMISSIONS.DEALS_EDIT,
    PERMISSIONS.DEALS_DELETE,
    // Canvas
    PERMISSIONS.CANVAS_VIEW,
    PERMISSIONS.CANVAS_EDIT,
    // Agents
    PERMISSIONS.AGENTS_VIEW,
    PERMISSIONS.AGENTS_EXECUTE,
    PERMISSIONS.AGENTS_CONFIGURE,
    // Team
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_INVITE,
    PERMISSIONS.TEAM_MANAGE,
    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
    // Billing
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_MANAGE,
    // Users
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.USERS_INVITE,
    // Roles
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.ROLES_ASSIGN,
    // Permissions
    PERMISSIONS.PERMISSIONS_READ,
    PERMISSIONS.PERMISSIONS_GRANT,
    PERMISSIONS.PERMISSIONS_REVOKE,
    // API Keys
    PERMISSIONS.API_KEYS_READ,
    PERMISSIONS.API_KEYS_CREATE,
    PERMISSIONS.API_KEYS_ROTATE,
    PERMISSIONS.API_KEYS_REVOKE,
    // Audit
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.AUDIT_EXPORT,
    // Secrets
    PERMISSIONS.SECRETS_READ,
    PERMISSIONS.SECRETS_LIST,
    PERMISSIONS.SECRETS_WRITE,
    PERMISSIONS.SECRETS_ROTATE,
    PERMISSIONS.SECRETS_DELETE,
    // Admin
    PERMISSIONS.ADMIN_ACCESS,
  ],

  [USER_ROLES.MANAGER]: [
    // Data operations
    PERMISSIONS.DATA_READ,
    PERMISSIONS.DATA_CREATE,
    PERMISSIONS.DATA_UPDATE,
    PERMISSIONS.DATA_DELETE,
    PERMISSIONS.DATA_EXPORT,
    // Deals
    PERMISSIONS.DEALS_VIEW,
    PERMISSIONS.DEALS_CREATE,
    PERMISSIONS.DEALS_EDIT,
    // Canvas
    PERMISSIONS.CANVAS_VIEW,
    PERMISSIONS.CANVAS_EDIT,
    // Agents
    PERMISSIONS.AGENTS_VIEW,
    PERMISSIONS.AGENTS_EXECUTE,
    // Team
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_INVITE,
    PERMISSIONS.TEAM_MANAGE,
    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    // Billing
    PERMISSIONS.BILLING_VIEW,
    // Users
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_INVITE,
    // API Keys
    PERMISSIONS.API_KEYS_READ,
    PERMISSIONS.API_KEYS_CREATE,
    // Audit
    PERMISSIONS.AUDIT_READ,
    // Secrets
    PERMISSIONS.SECRETS_READ,
    PERMISSIONS.SECRETS_LIST,
    PERMISSIONS.SECRETS_WRITE,
    PERMISSIONS.SECRETS_ROTATE,
  ],

  [USER_ROLES.MEMBER]: [
    // Data operations
    PERMISSIONS.DATA_READ,
    PERMISSIONS.DATA_CREATE,
    PERMISSIONS.DATA_UPDATE,
    // Deals
    PERMISSIONS.DEALS_VIEW,
    PERMISSIONS.DEALS_CREATE,
    // Canvas
    PERMISSIONS.CANVAS_VIEW,
    PERMISSIONS.CANVAS_EDIT,
    // Agents
    PERMISSIONS.AGENTS_VIEW,
    PERMISSIONS.AGENTS_EXECUTE,
    // Team
    PERMISSIONS.TEAM_VIEW,
    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    // Users
    PERMISSIONS.USERS_READ,
    // Secrets
    PERMISSIONS.SECRETS_READ,
    PERMISSIONS.SECRETS_LIST,
    PERMISSIONS.SECRETS_WRITE,
  ],

  [USER_ROLES.VIEWER]: [
    // Data operations
    PERMISSIONS.DATA_READ,
    // Deals
    PERMISSIONS.DEALS_VIEW,
    // Canvas
    PERMISSIONS.CANVAS_VIEW,
    // Agents
    PERMISSIONS.AGENTS_VIEW,
    // Team
    PERMISSIONS.TEAM_VIEW,
    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    // Users
    PERMISSIONS.USERS_READ,
    // Secrets
    PERMISSIONS.SECRETS_READ,
    PERMISSIONS.SECRETS_LIST,
  ],

  [USER_ROLES.GUEST]: [
    // Minimal read-only access
    PERMISSIONS.DATA_READ,
    PERMISSIONS.DEALS_VIEW,
    PERMISSIONS.CANVAS_VIEW,
  ],
};

// ============================================================================
// Agent Role-Permission Matrix
// ============================================================================

/**
 * Permissions granted to each agent role
 * Implements deny-by-default with explicit grants for agent actions
 */
export const AGENT_ROLE_PERMISSIONS: Record<AgentRole, Permission[]> = {
  [AGENT_ROLES.COORDINATOR]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.WORKFLOWS_READ,
    PERMISSIONS.WORKFLOWS_EXECUTE,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.OPPORTUNITY]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.TARGET]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.VMRT_WRITE,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.REALIZATION]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.VMRT_READ,
    PERMISSIONS.VMRT_WRITE,
    PERMISSIONS.CRM_WRITE,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.EXPANSION]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.VMRT_READ,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.INTEGRITY]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.VMRT_READ,
    PERMISSIONS.WORKFLOWS_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.VMRT_WRITE,
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.COMMUNICATOR]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.VMRT_READ,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.BENCHMARK]: [
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.NARRATIVE]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.VMRT_READ,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.ADVERSARIAL]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.VMRT_READ,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.FINANCIAL_MODELING]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.VMRT_WRITE,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.COMPANY_INTELLIGENCE]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.EXTERNAL_API_EXECUTE,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.VALUE_MAPPING]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.RESEARCH]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.EXTERNAL_API_EXECUTE,
    PERMISSIONS.LLM_EXECUTE,
  ],

  [AGENT_ROLES.SYSTEM]: [
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.BENCHMARKS_READ,
    PERMISSIONS.VMRT_READ,
    PERMISSIONS.WORKFLOWS_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.VMRT_WRITE,
    PERMISSIONS.WORKFLOWS_WRITE,
    PERMISSIONS.WORKFLOWS_EXECUTE,
    PERMISSIONS.LLM_EXECUTE,
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.AGENTS_CONFIGURE,
  ],
};

// ============================================================================
// Role Utilities
// ============================================================================

/**
 * Get permissions for a user role
 */
export function getPermissionsForUserRole(role: string): Permission[] {
  // Check if it's a legacy role
  const normalizedRole = LEGACY_ROLE_MAP[role] || role;
  return USER_ROLE_PERMISSIONS[normalizedRole as UserRole] || [];
}

/**
 * Get permissions for an agent role
 */
export function getPermissionsForAgentRole(role: string): Permission[] {
  return AGENT_ROLE_PERMISSIONS[role as AgentRole] || [];
}

/**
 * Compute all permissions from a list of roles
 */
export function computePermissionsFromRoles(roles: string[]): Permission[] {
  const permissions = new Set<Permission>();

  for (const role of roles) {
    // Try user roles first
    const userPerms = getPermissionsForUserRole(role);
    userPerms.forEach((p) => permissions.add(p));

    // Then try agent roles
    const agentPerms = getPermissionsForAgentRole(role);
    agentPerms.forEach((p) => permissions.add(p));
  }

  return Array.from(permissions);
}

/**
 * Check if a role is a valid user role
 */
export function isValidUserRole(role: string): role is UserRole {
  return Object.values(USER_ROLES).includes(role as UserRole);
}

/**
 * Check if a role is a valid agent role
 */
export function isValidAgentRole(role: string): role is AgentRole {
  return Object.values(AGENT_ROLES).includes(role as AgentRole);
}

/**
 * Normalize a legacy role name to the unified role system
 */
export function normalizeRole(role: string): UserRole | string {
  return LEGACY_ROLE_MAP[role] || role;
}

/**
 * Get all roles that have a specific permission
 */
export function getRolesWithPermission(permission: Permission): string[] {
  const roles: string[] = [];

  for (const [role, perms] of Object.entries(USER_ROLE_PERMISSIONS)) {
    if (perms.includes(permission)) {
      roles.push(role);
    }
  }

  for (const [role, perms] of Object.entries(AGENT_ROLE_PERMISSIONS)) {
    if (perms.includes(permission)) {
      roles.push(role);
    }
  }

  return roles;
}
