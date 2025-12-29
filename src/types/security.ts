/**
 * Security Types for Zero Trust Architecture
 * Defines granular capabilities for SOC 2 compliance (CC6.1 Access Control)
 */

// Define granular capabilities (Resource + Action)
export type Permission =
  | "VIEW_FINANCIALS" // Can see NPV, ROI, Cash Flow
  | "VIEW_TECHNICAL_DEBT" // Can see Code Churn, Velocity
  | "EXECUTE_AGENT" // Can trigger an autonomous workflow
  | "APPROVE_RISK" // Can override a Risk Guardrail
  | "ADMIN_SYSTEM"; // System configuration

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
 * Centralized permission matrix
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  CFO: ["VIEW_FINANCIALS", "APPROVE_RISK"],
  ADMIN: [
    "VIEW_FINANCIALS",
    "VIEW_TECHNICAL_DEBT",
    "EXECUTE_AGENT",
    "APPROVE_RISK",
    "ADMIN_SYSTEM",
  ],
  DEVELOPER: ["VIEW_TECHNICAL_DEBT", "EXECUTE_AGENT"],
  ANALYST: ["VIEW_FINANCIALS", "VIEW_TECHNICAL_DEBT"],
  AGENT: ["EXECUTE_AGENT"], // AI Agents have limited scope
};

/**
 * Compute permissions from roles
 */
export function computePermissions(roles: string[]): Permission[] {
  const permissions = new Set<Permission>();

  roles.forEach((role) => {
    const rolePerms = ROLE_PERMISSIONS[role.toUpperCase()];
    if (rolePerms) {
      rolePerms.forEach((p) => permissions.add(p));
    }
  });

  return Array.from(permissions);
}
