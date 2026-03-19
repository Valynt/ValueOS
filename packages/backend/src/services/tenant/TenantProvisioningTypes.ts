export type TenantTier = 'free' | 'starter' | 'professional' | 'enterprise';

export type TenantStatus = 'provisioning' | 'active' | 'suspended' | 'deactivated';

export interface TenantLimits {
  maxUsers: number;
  maxTeams: number;
  maxProjects: number;
  maxStorage: number;
  maxApiCalls: number;
  maxAgentCalls: number;
}

export interface TenantConfig {
  organizationId: string;
  name: string;
  tier: TenantTier;
  ownerId: string;
  ownerEmail: string;
  provisioningRequestKey?: string;
  settings?: Record<string, any>;
  features?: string[];
  limits?: TenantLimits;
}

export interface ProvisioningResult {
  success: boolean;
  organizationId: string;
  status: TenantStatus;
  createdAt: Date;
  resources: {
    organization: boolean;
    settings: boolean;
    teams: boolean;
    roles: boolean;
    billing: boolean;
    usage: boolean;
  };
  errors: string[];
  warnings: string[];
}

export interface TenantUsage {
  organizationId: string;
  period: string;
  users: number;
  teams: number;
  projects: number;
  storage: number;
  apiCalls: number;
  agentCalls: number;
  lastUpdated: Date;
}
