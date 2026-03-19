/**
 * Tenant tier limits and feature flags.
 *
 * Extracted from TenantProvisioning.ts to keep limit lookups separate from
 * provisioning orchestration. Both modules share these constants.
 */

import type { TenantLimits, TenantTier, TenantUsage } from "./TenantProvisioningTypes.js";

export const TIER_LIMITS: Record<TenantTier, TenantLimits> = {
  free: {
    maxUsers: 3,
    maxTeams: 1,
    maxProjects: 5,
    maxStorage: 1073741824, // 1 GB
    maxApiCalls: 1000,
    maxAgentCalls: 100,
  },
  starter: {
    maxUsers: 10,
    maxTeams: 3,
    maxProjects: 25,
    maxStorage: 10737418240, // 10 GB
    maxApiCalls: 10000,
    maxAgentCalls: 1000,
  },
  professional: {
    maxUsers: 50,
    maxTeams: 10,
    maxProjects: 100,
    maxStorage: 107374182400, // 100 GB
    maxApiCalls: 100000,
    maxAgentCalls: 10000,
  },
  enterprise: {
    maxUsers: -1, // unlimited
    maxTeams: -1,
    maxProjects: -1,
    maxStorage: -1,
    maxApiCalls: -1,
    maxAgentCalls: -1,
  },
};

export const TIER_FEATURES: Record<TenantTier, string[]> = {
  free: [
    'basic_canvas',
    'basic_agents',
    'basic_workflows',
  ],
  starter: [
    'basic_canvas',
    'basic_agents',
    'basic_workflows',
    'team_collaboration',
    'basic_analytics',
  ],
  professional: [
    'basic_canvas',
    'advanced_agents',
    'advanced_workflows',
    'team_collaboration',
    'advanced_analytics',
    'custom_templates',
    'api_access',
  ],
  enterprise: [
    'basic_canvas',
    'advanced_agents',
    'advanced_workflows',
    'team_collaboration',
    'advanced_analytics',
    'custom_templates',
    'api_access',
    'sso',
    'audit_logs',
    'custom_integrations',
    'dedicated_support',
    'sla',
  ],
};

export function getTenantLimits(tier: TenantTier): TenantLimits {
  return TIER_LIMITS[tier];
}

export function getTenantFeatures(tier: TenantTier): string[] {
  return TIER_FEATURES[tier];
}

export function hasFeature(tier: TenantTier, feature: string): boolean {
  return TIER_FEATURES[tier].includes(feature);
}

export function isWithinLimits(
  usage: TenantUsage,
  limits: TenantLimits
): { within: boolean; exceeded: string[] } {
  const exceeded: string[] = [];

  if (limits.maxUsers !== -1 && usage.users > limits.maxUsers) exceeded.push('users');
  if (limits.maxTeams !== -1 && usage.teams > limits.maxTeams) exceeded.push('teams');
  if (limits.maxProjects !== -1 && usage.projects > limits.maxProjects) exceeded.push('projects');
  if (limits.maxStorage !== -1 && usage.storage > limits.maxStorage) exceeded.push('storage');
  if (limits.maxApiCalls !== -1 && usage.apiCalls > limits.maxApiCalls) exceeded.push('apiCalls');
  if (limits.maxAgentCalls !== -1 && usage.agentCalls > limits.maxAgentCalls) exceeded.push('agentCalls');

  return { within: exceeded.length === 0, exceeded };
}
