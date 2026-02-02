/**
 * Domain types - core business entities
 */

import type { UserRole } from "../lib/permissions/roles";

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

// Re-export UserRole for convenience (canonical definition in lib/permissions/roles)
export type { UserRole } from "../lib/permissions/roles";

export interface User {
  id: string;
  email: string;
  tenantId: string;
  role: UserRole;
}
