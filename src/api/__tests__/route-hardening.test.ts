import { describe, expect, it, vi } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }),
}));

vi.mock('../../services/billing/StripeService', () => ({
  default: {
    getInstance: () => ({ getClient: () => ({}) }),
  },
}));

vi.mock('../../config/secrets/AWSSecretProvider', () => ({
  AWSSecretProvider: class {
    async getSecret() {
      return '';
    }

    async rotateSecret() {
      return '';
    }
  },
}));

vi.mock('redis', () => ({
  createClient: () => ({
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    isOpen: true,
  }),
}));

vi.mock('express-rate-limit', () => ({
  __esModule: true,
  default: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('rate-limit-redis', () => ({
  __esModule: true,
  default: class {},
}));

vi.mock('ioredis', () => ({
  __esModule: true,
  default: class {
    on = vi.fn();
    quit = vi.fn();
    disconnect = vi.fn();
  },
}));

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: class {},
  GetSecretValueCommand: class {},
  DescribeSecretCommand: class {},
  RotateSecretCommand: class {},
}));

vi.mock('../../services/LLMFallback', () => ({
  llmFallback: {
    processRequest: vi.fn().mockResolvedValue({
      content: '',
      provider: 'mock',
      model: 'mock',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      latency: 0,
      cached: false,
    }),
    getStats: vi.fn(() => ({})),
    healthCheck: vi.fn(async () => ({
      togetherAI: { healthy: true },
      openAI: { healthy: true },
    })),
    reset: vi.fn(),
  },
}));

vi.mock('../../services/metering/MetricsCollector', () => ({
  default: {
    getUsageSummary: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../services/metering/UsageCache', () => ({
  default: {
    getCurrentUsage: vi.fn().mockResolvedValue(0),
    getQuota: vi.fn().mockResolvedValue(0),
    getUsagePercentage: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('../../services/billing/CustomerService', () => ({
  default: {
    getActiveSubscription: vi.fn().mockResolvedValue(null),
    createCustomer: vi.fn(),
  },
}));

vi.mock('../../services/billing/SubscriptionService', () => ({
  default: {
    getActiveSubscription: vi.fn().mockResolvedValue(null),
    createSubscription: vi.fn().mockResolvedValue({}),
    updateSubscription: vi.fn().mockResolvedValue({}),
    cancelSubscription: vi.fn().mockResolvedValue({}),
  },
}));

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
process.env.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_dummy';
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-key';

import authRouter from '../auth';
import billingRouter from '../billing';
import healthRouter from '../health';
import llmRouter from '../llm';

function collectMiddlewareNames(router: any): string[] {
  const names: string[] = [];
  const stack = router?.stack || [];

  for (const layer of stack) {
    const layerName = layer.name || layer.handle?.name;
    if (layerName && layerName !== '<anonymous>') {
      names.push(layerName);
    }

    const handle = layer.handle || layer.route;

    if (handle?.stack) {
      names.push(...collectMiddlewareNames(handle));
    } else if (handle?.route?.stack) {
      names.push(...collectMiddlewareNames(handle.route));
    }
  }

  return names;
}

const ROUTERS = [
  { name: 'Auth', router: authRouter },
  { name: 'Billing', router: billingRouter },
  { name: 'Health', router: healthRouter },
  { name: 'LLM', router: llmRouter },
];

describe('Route hardening', () => {
  it.each(ROUTERS)('%s router applies security headers middleware', ({ router }) => {
    const names = collectMiddlewareNames(router);
    expect(names).toContain('securityHeadersMiddleware');
  });

  it('enforces RBAC middleware on billing routes', () => {
    const names = collectMiddlewareNames(billingRouter);
    const hasRbac = names.some((name) => name.includes('requirePermission') || name.includes('requireRole'));
    expect(hasRbac).toBe(true);
  });
});

