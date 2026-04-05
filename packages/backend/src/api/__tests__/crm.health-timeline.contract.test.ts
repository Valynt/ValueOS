import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

const { getHealthTimelineMock } = vi.hoisted(() => ({
  getHealthTimelineMock: vi.fn(),
}));

vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      id: 'user-1',
      email: 'admin@valueos.io',
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    } as never;
    next();
  },
}));

vi.mock('../../middleware/rbac', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/tenantContext', () => ({
  tenantContextMiddleware: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.tenantId = 'tenant-1';
    next();
  },
}));

vi.mock('../../middleware/rateLimiter', () => ({
  createRateLimiter: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../services/crm/CrmConnectionService', () => ({
  crmConnectionService: {
    startOAuth: vi.fn(),
    completeOAuthAfterStateValidation: vi.fn(),
    disconnect: vi.fn(),
    getConnection: vi.fn(),
  },
}));

vi.mock('../../services/crm/OAuthStateStore', () => ({
  consumeOAuthState: vi.fn(),
}));

vi.mock('../../workers/crmWorker', () => ({
  getCrmSyncQueue: () => ({ add: vi.fn() }),
  getCrmWebhookQueue: () => ({ add: vi.fn() }),
}));

vi.mock('../../services/crm/CRMIntegrationService', () => ({
  crmIntegrationService: {
    syncNow: vi.fn(),
    fetchDeals: vi.fn(),
  },
}));

vi.mock('../../services/crm/CrmProviderRegistry', () => ({
  getCrmProvider: vi.fn(),
  getProviderCapabilityRegistry: vi.fn(() => []),
}));

vi.mock('../../services/crm/CrmWebhookService', () => ({
  crmWebhookService: {
    ingestWebhook: vi.fn(),
    processEvent: vi.fn(),
  },
}));

vi.mock('../../services/security/AuditLogService', () => ({
  auditLogService: {
    logAudit: vi.fn(),
  },
}));

vi.mock('../../services/crm/CrmHealthService', () => ({
  crmHealthService: {
    getHealth: vi.fn(),
    getHealthTimeline: getHealthTimelineMock,
  },
}));

import crmRouter from '../crm';


const TenantHealthTimelineResponseSchema = z.object({
  tenantId: z.string(),
  generatedAt: z.string(),
  providers: z.array(z.object({
    provider: z.enum(['salesforce', 'hubspot']),
    current: z.object({
      tenantId: z.string(),
      provider: z.enum(['salesforce', 'hubspot']),
      status: z.string(),
      degraded: z.boolean(),
      lastSyncAt: z.string().nullable(),
      lastSuccessfulSyncAt: z.string().nullable(),
      lastSuccessfulWebhookAt: z.string().nullable(),
      lastSuccessfulProcessAt: z.string().nullable(),
      syncLagSeconds: z.number().nullable(),
      tokenHealth: z.enum(['valid', 'expiring_soon', 'expired']),
      errorRate1h: z.number(),
      webhookThroughput1h: z.number(),
      consecutiveFailureCount: z.number(),
      mttrSeconds: z.number().nullable(),
      mttrSampleSize: z.number(),
      alerts: z.array(z.object({
        level: z.enum(['warning', 'critical']),
        code: z.string(),
        message: z.string(),
      })),
    }).nullable(),
    slo: z.object({
      status: z.enum(['healthy', 'warning', 'critical']),
      targetMttrSeconds: z.number(),
      currentMttrSeconds: z.number().nullable(),
      maxConsecutiveFailures: z.number(),
      consecutiveFailureCount: z.number(),
    }),
    timeline: z.array(z.object({
      id: z.string(),
      provider: z.enum(['salesforce', 'hubspot']),
      type: z.enum(['incident_started', 'incident_recovered']),
      startedAt: z.string(),
      resolvedAt: z.string().nullable(),
      durationSeconds: z.number().nullable(),
      severity: z.enum(['warning', 'critical']),
      reasonCode: z.string(),
      summary: z.string(),
    })),
  })),
});


describe('CRM health timeline endpoint contract', () => {
  it('returns tenant health timeline payload matching schema', async () => {
    getHealthTimelineMock.mockResolvedValue({
      tenantId: 'tenant-1',
      generatedAt: '2026-04-05T00:00:00.000Z',
      providers: [
        {
          provider: 'salesforce',
          current: {
            tenantId: 'tenant-1',
            provider: 'salesforce',
            status: 'connected',
            degraded: false,
            lastSyncAt: '2026-04-05T00:00:00.000Z',
            lastSuccessfulSyncAt: '2026-04-05T00:00:00.000Z',
            lastSuccessfulWebhookAt: '2026-04-05T00:05:00.000Z',
            lastSuccessfulProcessAt: '2026-04-05T00:05:02.000Z',
            syncLagSeconds: 90,
            tokenHealth: 'valid',
            errorRate1h: 0,
            webhookThroughput1h: 20,
            consecutiveFailureCount: 0,
            mttrSeconds: 420,
            mttrSampleSize: 4,
            alerts: [],
          },
          slo: {
            status: 'healthy',
            targetMttrSeconds: 1800,
            currentMttrSeconds: 420,
            maxConsecutiveFailures: 5,
            consecutiveFailureCount: 0,
          },
          timeline: [
            {
              id: 'incident-1',
              provider: 'salesforce',
              type: 'incident_recovered',
              startedAt: '2026-04-04T00:00:00.000Z',
              resolvedAt: '2026-04-04T00:07:00.000Z',
              durationSeconds: 420,
              severity: 'critical',
              reasonCode: 'WEBHOOK_PROCESSING_FAILED',
              summary: 'Recovered after token refresh',
            },
          ],
        },
      ],
    });

    const app = express();
    app.use('/api/crm', crmRouter);

    const response = await request(app).get('/api/crm/health/timeline?lookbackDays=14');

    expect(response.status).toBe(200);
    expect(() => TenantHealthTimelineResponseSchema.parse(response.body)).not.toThrow();
    expect(getHealthTimelineMock).toHaveBeenCalledWith('tenant-1', 14);
  });
});
