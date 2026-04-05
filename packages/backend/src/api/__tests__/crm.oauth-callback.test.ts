import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  consumeOAuthStateMock,
  completeOAuthAfterStateValidationMock,
  queueAddMock,
  logAuditMock,
} = vi.hoisted(() => ({
  consumeOAuthStateMock: vi.fn(),
  completeOAuthAfterStateValidationMock: vi.fn(),
  queueAddMock: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock('../../middleware/auth', () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/rbac', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/tenantContext', () => ({
  tenantContextMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../middleware/rateLimiter', () => ({
  createRateLimiter: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../services/crm/OAuthStateStore', () => ({
  consumeOAuthState: consumeOAuthStateMock,
}));

vi.mock('../../services/crm/CrmConnectionService', () => ({
  crmConnectionService: {
    startOAuth: vi.fn(),
    completeOAuthAfterStateValidation: completeOAuthAfterStateValidationMock,
    disconnect: vi.fn(),
    getConnection: vi.fn(),
  },
}));

vi.mock('../../services/security/AuditLogService', () => ({
  auditLogService: {
    logAudit: logAuditMock,
  },
}));

vi.mock('../../workers/crmWorker', () => ({
  getCrmSyncQueue: () => ({ add: queueAddMock }),
  getCrmWebhookQueue: () => ({ add: vi.fn() }),
}));

vi.mock('../../services/crm/CrmHealthService', () => ({
  crmHealthService: {
    getHealth: vi.fn(),
  },
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
    validateAndParse: vi.fn(),
    processEvent: vi.fn(),
  },
}));

import crmRouter from '../crm';

describe('CRM OAuth callback APP_URL origin enforcement', () => {
  const originalAppUrl = process.env.APP_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = originalAppUrl;

    consumeOAuthStateMock.mockResolvedValue({ tenantId: 'tenant-1' });
    completeOAuthAfterStateValidationMock.mockResolvedValue({
      id: 'conn-1',
      status: 'connected',
    });
    queueAddMock.mockResolvedValue(undefined);
    logAuditMock.mockResolvedValue(undefined);
  });

  it('rejects callback when APP_URL is missing', async () => {
    delete process.env.APP_URL;

    const app = express();
    app.use('/api/crm', crmRouter);

    const response = await request(app)
      .get('/api/crm/hubspot/connect/callback?code=test-code&state=test-state');

    expect(response.status).toBe(500);
    expect(response.text).toContain('OAuth callback misconfiguration');
    expect(consumeOAuthStateMock).not.toHaveBeenCalled();
    expect(completeOAuthAfterStateValidationMock).not.toHaveBeenCalled();
  });

  it('rejects callback when request origin is not allowlisted', async () => {
    process.env.APP_URL = 'https://app.valueos.com';

    const app = express();
    app.use('/api/crm', crmRouter);

    const response = await request(app)
      .get('/api/crm/hubspot/connect/callback?code=test-code&state=test-state')
      .set('Origin', 'https://evil.example');

    expect(response.status).toBe(403);
    expect(response.text).toContain('unexpected origin');
    expect(consumeOAuthStateMock).not.toHaveBeenCalled();
    expect(completeOAuthAfterStateValidationMock).not.toHaveBeenCalled();
  });

  it('accepts callback when APP_URL is valid and origin exactly matches', async () => {
    process.env.APP_URL = 'https://app.valueos.com/some/path';

    const app = express();
    app.use('/api/crm', crmRouter);

    const response = await request(app)
      .get('/api/crm/hubspot/connect/callback?code=test-code&state=test-state')
      .set('Origin', 'https://app.valueos.com');

    expect(response.status).toBe(200);
    expect(response.text).toContain("type: 'crm-oauth-complete'");
    expect(response.text).toContain('"https://app.valueos.com"');
    expect(consumeOAuthStateMock).toHaveBeenCalledWith('test-state', 'hubspot');
    expect(completeOAuthAfterStateValidationMock).toHaveBeenCalled();
  });
});
