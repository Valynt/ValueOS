/**
 * Domain types - core business entities
 */

import type { UserRole } from "../lib/permissions/roles.js";

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

// UserRole is exported from @valueos/shared via lib/permissions

export interface User {
  id: string;
  email: string;
  tenantId: string;
  role: UserRole;
}
