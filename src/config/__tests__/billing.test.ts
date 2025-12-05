/**
 * Billing Configuration Tests
 */

import { describe, it, expect } from 'vitest';
import {
  PLANS,
  getPlan,
  getQuota,
  calculateOverageCost,
  calculateMonthlyCost,
  formatMetricName,
  formatUsageAmount,
} from '../billing';

describe('Billing Configuration', () => {
  it('should have correct plan structure', () => {
    expect(PLANS.free).toBeDefined();
    expect(PLANS.standard).toBeDefined();
    expect(PLANS.enterprise).toBeDefined();
  });

  it('should get plan by tier', () => {
    const freePlan = getPlan('free');
    expect(freePlan.tier).toBe('free');
    expect(freePlan.price).toBe(0);
  });

  it('should get quota for metric', () => {
    const llmQuota = getQuota('standard', 'llm_tokens');
    expect(llmQuota).toBe(1_000_000);
  });

  it('should calculate overage cost', () => {
    const cost = calculateOverageCost('standard', 'llm_tokens', 1_500_000);
    // 500k overage * $0.00001 = $5
    expect(cost).toBe(5);
  });

  it('should calculate total monthly cost', () => {
    const usage = {
      llm_tokens: 1_500_000,
      agent_executions: 5_500,
      api_calls: 120_000,
      storage_gb: 105,
      user_seats: 27,
    };

    const costs = calculateMonthlyCost('standard', usage);
    
    expect(costs.baseCost).toBe(99);
    expect(costs.overageCosts.llm_tokens).toBe(5);
    expect(costs.overageCosts.agent_executions).toBe(50);
    expect(costs.totalOverage).toBeGreaterThan(0);
    expect(costs.totalCost).toBeGreaterThan(99);
  });

  it('should format metric names', () => {
    expect(formatMetricName('llm_tokens')).toBe('LLM Tokens');
    expect(formatMetricName('agent_executions')).toBe('Agent Executions');
  });

  it('should format usage amounts', () => {
    expect(formatUsageAmount('llm_tokens', 1000)).toContain('1,000 tokens');
    expect(formatUsageAmount('storage_gb', 5.5)).toContain('5.50 GB');
    expect(formatUsageAmount('user_seats', 3)).toContain('3 seats');
  });

  it('should handle free tier correctly', () => {
    const freePlan = PLANS.free;
    expect(freePlan.price).toBe(0);
    expect(freePlan.hardCaps.storage_gb).toBe(true);
    expect(freePlan.hardCaps.user_seats).toBe(true);
    expect(Object.values(freePlan.overageRates).every(rate => rate === 0)).toBe(true);
  });

  it('should have discounted rates for enterprise', () => {
    const stdRate = PLANS.standard.overageRates.llm_tokens;
    const entRate = PLANS.enterprise.overageRates.llm_tokens;
    expect(entRate).toBeLessThan(stdRate);
  });
});
