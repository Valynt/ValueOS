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

vi.mock(
  '../../services/AdminUserService',
  () => ({
  adminUserService: {
    listTenantUsers: vi.fn().mockResolvedValue([]),
    inviteUserToTenant: vi.fn().mockResolvedValue({}),
    updateUserRole: vi.fn().mockResolvedValue(undefined),
    removeUserFromTenant: vi.fn().mockResolvedValue(undefined),
  },
  }),
  { virtual: true }
);

vi.mock(
  '../../services/ModelCardService',
  () => ({
  modelCardService: {
    getModelCard: vi.fn(() => ({ schemaVersion: '1.0.0', modelCard: {} })),
  },
  }),
  { virtual: true }
);

vi.mock(
  '../../services/UnifiedAgentAPI',
  () => ({
  getUnifiedAgentAPI: () => ({
    invoke: vi.fn().mockResolvedValue({ success: true }),
  }),
  }),
  { virtual: true }
);

vi.mock(
  '../../services/MessageQueue',
  () => ({
  llmQueue: {
    addJob: vi.fn().mockResolvedValue({ id: 'job-id' }),
    getJobStatus: vi.fn().mockResolvedValue({ status: 'queued' }),
    getJobResult: vi.fn().mockResolvedValue({}),
    cancelJob: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockResolvedValue({}),
    getJobs: vi.fn().mockResolvedValue([]),
  },
  }),
  { virtual: true }
);

vi.mock(
  '../../services/consentRegistry',
  () => ({
  consentRegistry: {
    isConsentRequired: vi.fn(() => false),
    registerConsent: vi.fn(),
  },
  }),
  { virtual: true }
);

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
process.env.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_dummy';
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-key';

import authRouter from '../auth';
import adminRouter from '../admin';
import agentsRouter from '../agents';
import approvalsRouter from '../approvals';
import billingRouter from '../billing';
import canvasRouter from '../canvas';
import docsRouter from '../docs';
import documentsRouter from '../documents';
import groundtruthRouter from '../groundtruth';
import healthRouter from '../health';
import knowledgeUploadRouter from '../knowledgeUpload';
import llmRouter from '../llm';
import projectsRouter from '../projects';
import queueRouter from '../queue';
import workflowRouter from '../workflow';
import customerRouter from '../customer';

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
  { name: 'Admin', router: adminRouter },
  { name: 'Agents', router: agentsRouter },
  { name: 'Approvals', router: approvalsRouter },
  { name: 'Auth', router: authRouter },
  { name: 'Billing', router: billingRouter },
  { name: 'Canvas', router: canvasRouter },
  { name: 'Docs', router: docsRouter },
  { name: 'Documents', router: documentsRouter },
  { name: 'Groundtruth', router: groundtruthRouter },
  { name: 'Health', router: healthRouter },
  { name: 'KnowledgeUpload', router: knowledgeUploadRouter },
  { name: 'LLM', router: llmRouter },
  { name: 'Projects', router: projectsRouter },
  { name: 'Queue', router: queueRouter },
  { name: 'Workflow', router: workflowRouter },
  { name: 'Customer', router: customerRouter },
];

const RBAC_EXEMPT_ROUTERS = new Set(['Approvals', 'Auth', 'Customer', 'Docs', 'Health', 'LLM', 'Queue']);

describe('Route hardening', () => {
  it.each(ROUTERS)('%s router applies security headers middleware', ({ router }) => {
    const names = collectMiddlewareNames(router);
    expect(names).toContain('securityHeadersMiddleware');
  });


  it.each(ROUTERS)('%s router applies request sanitization middleware', ({ router }) => {
    const names = collectMiddlewareNames(router);
    expect(names).toContain('requestSanitizationMiddleware');
  });

  it.each(ROUTERS)('%s router enforces RBAC or is explicitly exempt', ({ name, router }) => {
    const names = collectMiddlewareNames(router);
    const hasRbac = names.some(
      (middlewareName) =>
        middlewareName.includes('requirePermission') || middlewareName.includes('requireRole')
    );

    if (RBAC_EXEMPT_ROUTERS.has(name)) {
      return;
    }

    expect(hasRbac).toBe(true);
  });
});
