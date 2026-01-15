export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  plan: TenantPlan;
  status: TenantStatus;
  settings: TenantSettings;
  createdAt: string;
  updatedAt: string;
}

export type TenantPlan = "free" | "pro" | "enterprise";
export type TenantStatus = "active" | "suspended" | "pending";

export interface TenantSettings {
  branding?: {
    logo?: string;
    primaryColor?: string;
    favicon?: string;
  };
  features?: {
    sso?: boolean;
    audit?: boolean;
    compliance?: boolean;
    customDomain?: boolean;
  };
  limits?: {
    users?: number;
    projects?: number;
    storage?: number;
  };
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
}
