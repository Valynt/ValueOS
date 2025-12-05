/**
 * Stripe Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import StripeService from '../StripeService';

describe('StripeService', () => {
  let stripeService: StripeService;

  beforeEach(() => {
    stripeService = StripeService.getInstance();
  });

  it('should be a singleton', () => {
    const instance1 = StripeService.getInstance();
    const instance2 = StripeService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should generate unique idempotency keys', () => {
    const key1 = stripeService.generateIdempotencyKey('test', 'id1');
    const key2 = stripeService.generateIdempotencyKey('test', 'id1');
    expect(key1).not.toBe(key2); // Different timestamps
    expect(key1).toContain('test_id1_');
  });

  it('should handle Stripe errors', () => {
    const cardError = {
      type: 'StripeCardError',
      message: 'Card declined',
    };

    expect(() => {
      stripeService.handleError(cardError, 'test');
    }).toThrow('Card error: Card declined');
  });
});
