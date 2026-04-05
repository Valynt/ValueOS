import type {
  ResourceQuotas,
  ResourceType,
  ServiceLevelAgreement,
  TenantPriority,
  TenantTier,
} from './TenantPerformanceManager.js';
import {
  getDefaultAlertThresholds,
  getDefaultQuotas,
  getDefaultSLA,
  getPriorityForTier,
  getPriorityWeight,
  getQuotaForResource,
  getQuotasForTier,
  getSLAForTier,
  getTierWeight,
} from './tenant-performance-defaults.js';

export const TenantPerformancePolicy = {
  getQuotaForResource,
  getQuotasForTier,
  getSLAForTier,
  getPriorityForTier,
  getPriorityWeight,
  getTierWeight,
  getDefaultQuotas,
  getDefaultSLA,
  getDefaultAlertThresholds,
} as const;

export function resolveQuotaForResource(quotas: ResourceQuotas, resourceType: ResourceType): number {
  return TenantPerformancePolicy.getQuotaForResource(quotas, resourceType);
}

export function resolveTierQuotas(tier: TenantTier): ResourceQuotas {
  return TenantPerformancePolicy.getQuotasForTier(tier);
}

export function resolveTierSLA(tier: TenantTier): ServiceLevelAgreement {
  return TenantPerformancePolicy.getSLAForTier(tier);
}

export function resolveTierPriority(tier: TenantTier): TenantPriority {
  return TenantPerformancePolicy.getPriorityForTier(tier);
}

export function resolvePriorityWeight(priority: TenantPriority): number {
  return TenantPerformancePolicy.getPriorityWeight(priority);
}

export function resolveTierWeight(tier: TenantTier): number {
  return TenantPerformancePolicy.getTierWeight(tier);
}

export function resolveDefaultQuotas(): ResourceQuotas {
  return TenantPerformancePolicy.getDefaultQuotas();
}

export function resolveDefaultSLA(): ServiceLevelAgreement {
  return TenantPerformancePolicy.getDefaultSLA();
}

export function resolveDefaultAlertThresholds(): Record<string, number> {
  return TenantPerformancePolicy.getDefaultAlertThresholds();
}
