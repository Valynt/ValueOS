/**
 * Domain types - core business entities
 */

export interface Tenant {
  id: string;
  name: string;
  plan: PlanTier;
  createdAt: Date;
}

export type PlanTier = "free" | "standard" | "enterprise";

export interface User {
  id: string;
  email: string;
  tenantId: string;
  role: UserRole;
}

export type UserRole = "admin" | "member" | "viewer";
