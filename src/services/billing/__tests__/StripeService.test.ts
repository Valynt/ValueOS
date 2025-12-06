/**
 * Stripe Service Tests
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock the billing config before importing StripeService
vi.mock('../../../config/billing', () => ({
  STRIPE_CONFIG: {
    secretKey: 'sk_test_mock_key_for_testing',
    publishableKey: 'pk_test_mock_key_for_testing',
    webhookSecret: 'whsec_test_mock_secret',
    apiVersion: '2023-10-16',
  },
  PLANS: {
    free: { tier: 'free', quotas: {}, hardCaps: {}, overageRates: {} },
    standard: { tier: 'standard', quotas: {}, hardCaps: {}, overageRates: {} },
    enterprise: { tier: 'enterprise', quotas: {}, hardCaps: {}, overageRates: {} },
  },
}));

describe('StripeService', () => {
  let StripeService: any;

  beforeAll(async () => {
    const module = await import('../StripeService');
    StripeService = module.default;
  });

  it('should be a singleton', () => {
    const instance1 = StripeService.getInstance();
    const instance2 = StripeService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should generate unique idempotency keys', async () => {
    const stripeService = StripeService.getInstance();
    
    const key1 = stripeService.generateIdempotencyKey('test', 'id1');
    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 1));
    const key2 = stripeService.generateIdempotencyKey('test', 'id1');
    expect(key1).not.toBe(key2); // Different timestamps
    expect(key1).toContain('test_id1_');
    expect(key2).toContain('test_id1_');
  });

  it('should handle Stripe errors', () => {
    const stripeService = StripeService.getInstance();
    
    const cardError = {
      type: 'StripeCardError',
      message: 'Card declined',
    };

    expect(() => {
      stripeService.handleError(cardError, 'test');
    }).toThrow('Card error: Card declined');
  });

  it('should handle API errors', () => {
    const stripeService = StripeService.getInstance();
    
    const apiError = {
      type: 'StripeAPIError',
      message: 'API error occurred',
    };

    expect(() => {
      stripeService.handleError(apiError, 'test');
    }).toThrow('Stripe API error. Please try again later.');
  });

  it('should handle invalid request errors', () => {
    const stripeService = StripeService.getInstance();
    
    const invalidError = {
      type: 'StripeInvalidRequestError',
      message: 'Invalid parameter',
    };

    expect(() => {
      stripeService.handleError(invalidError, 'test');
    }).toThrow('Invalid request: Invalid parameter');
  });
});
