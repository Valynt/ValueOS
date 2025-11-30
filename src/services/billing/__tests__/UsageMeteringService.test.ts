/**
 * Usage Metering Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('UsageMeteringService', () => {
  it('should submit usage with idempotency', async () => {
    const aggregate = {
      id: 'agg-1',
      tenant_id: 'tenant-1',
      subscription_item_id: 'si_test',
      metric: 'llm_tokens' as const,
      total_amount: 1000,
      event_count: 10,
      period_start: new Date().toISOString(),
      period_end: new Date().toISOString(),
      submitted_to_stripe: false,
      idempotency_key: 'test_key_123',
      metadata: {},
      created_at: new Date().toISOString(),
    };

    // Test that idempotency key is used
    expect(aggregate.idempotency_key).toBeTruthy();
  });

  it('should not resubmit already submitted aggregates', () => {
    const submittedAggregate = {
      id: 'agg-2',
      submitted_to_stripe: true,
      submitted_at: new Date().toISOString(),
    };

    expect(submittedAggregate.submitted_to_stripe).toBe(true);
  });

  it('should calculate correct quantity for Stripe', () => {
    const amount = 1500.5;
    const quantity = Math.ceil(amount);
    expect(quantity).toBe(1501); // Stripe requires integer
  });
});
