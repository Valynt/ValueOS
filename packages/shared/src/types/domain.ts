/**
 * Domain types - core business entities
 */

export interface Tenant {
  id: string;
  name: string;
  plan: PlanTier;
  createdAt: Date;
}

export interface TenantScopedRecord {
  tenant_id: string;
}

export type PlanTier = "free" | "standard" | "enterprise";

export interface User {
  id: string;
  email: string;
  tenantId: string;
  role: UserRole;
}

// UserRole is exported from lib/permissions/roles.ts
// export type UserRole = "admin" | "member" | "viewer";
