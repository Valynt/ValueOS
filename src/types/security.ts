/**
 * Security Types for Zero Trust Architecture
 * Defines granular capabilities for SOC 2 compliance (CC6.1 Access Control)
 *
 * @deprecated Permission types have been unified. Import from '@/lib/permissions' instead.
 * This file is maintained for backward compatibility.
 */

import {
  type Permission as UnifiedPermission,
  computePermissionsFromRoles,
  USER_ROLE_PERMISSIONS,
} from "../lib/permissions";

// Re-export unified Permission type for backward compatibility
export type Permission = UnifiedPermission;

// The User Claims structure coming from OIDC (Auth0/Okta)
export interface UserClaims {
  sub: string; // Subject ID
  email: string;
  roles: string[]; // e.g., ['CFO', 'ADMIN']
  permissions: Permission[]; // Computed permissions based on roles
  org_id: string;
}

// Audit Event structure for SOC 2 compliance
export interface SecurityAuditEvent {
  timestamp: string;
  userId: string;
  action: "ACCESS_DENIED" | "ACCESS_GRANTED";
  resource: string;
  requiredPermissions: Permission[];
  userPermissions: Permission[];
  ipAddress?: string; // Injected by backend usually, but tracked here if possible
}

/**
 * Role to Permission Mapping
 * @deprecated Use USER_ROLE_PERMISSIONS from '@/lib/permissions' instead
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ...USER_ROLE_PERMISSIONS,
  // Legacy role mappings for backward compatibility
  CFO: USER_ROLE_PERMISSIONS["manager"] || [],
  ADMIN: USER_ROLE_PERMISSIONS["admin"] || [],
  DEVELOPER: USER_ROLE_PERMISSIONS["member"] || [],
  ANALYST: USER_ROLE_PERMISSIONS["member"] || [],
  AGENT: USER_ROLE_PERMISSIONS["member"] || [],
};

/**
 * Compute permissions from roles
 * @deprecated Use computePermissionsFromRoles from '@/lib/permissions' instead
 */
export function computePermissions(roles: string[]): Permission[] {
  return computePermissionsFromRoles(roles);
}
