import { describe, expect, it } from 'vitest';

import {
  resolveDefaultAlertThresholds,
  resolveDefaultQuotas,
  resolveDefaultSLA,
  resolvePriorityWeight,
  resolveQuotaForResource,
  resolveTierPriority,
  resolveTierQuotas,
  resolveTierSLA,
  resolveTierWeight,
} from './TenantPerformancePolicy.js';

describe('TenantPerformancePolicy seams', () => {
  it('resolves tier policy shapes used by TenantPerformanceManager', () => {
    expect(resolveTierQuotas('enterprise').maxConcurrentAgents).toBeGreaterThan(0);
    expect(resolveTierSLA('enterprise').availability).toBeGreaterThan(0);
    expect(resolveTierPriority('enterprise')).toBeDefined();
  });

  it('resolves quota by resource type', () => {
    const quotas = resolveTierQuotas('professional');
    expect(resolveQuotaForResource(quotas, 'agents')).toBe(quotas.maxConcurrentAgents);
    expect(resolveQuotaForResource(quotas, 'memory')).toBe(quotas.maxAgentMemoryUsage);
  });

  it('exposes deterministic weight and default resolvers', () => {
    expect(resolvePriorityWeight('critical')).toBeGreaterThan(resolvePriorityWeight('low'));
    expect(resolveTierWeight('enterprise')).toBeGreaterThan(resolveTierWeight('basic'));
    expect(resolveDefaultQuotas().maxConcurrentAgents).toBeGreaterThan(0);
    expect(resolveDefaultSLA().availability).toBeGreaterThan(0);
    expect(resolveDefaultAlertThresholds()).toHaveProperty('cpu_utilization');
  });
});
