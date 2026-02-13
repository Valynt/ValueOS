import express from 'express';
import { AddressInfo } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import crmRouter from '../crm.js';

const { consumeOAuthStateOnce, completeOAuth, logSecurityEvent } = vi.hoisted(() => ({
  consumeOAuthStateOnce: vi.fn(),
  completeOAuth: vi.fn(),
  logSecurityEvent: vi.fn(),
}));

vi.mock('../../services/crm/CrmConnectionService.js', () => ({
  crmConnectionService: {
    consumeOAuthStateOnce,
    completeOAuth,
    startOAuth: vi.fn(),
    disconnect: vi.fn(),
    getConnection: vi.fn(),
    getTokens: vi.fn(),
  },
}));

vi.mock('../../services/AuditLogService.js', () => ({
  auditLogService: { logAudit: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../workers/crmWorker.js', () => ({
  getCrmSyncQueue: () => ({ add: vi.fn().mockResolvedValue({ id: 'job-1' }) }),
  getCrmWebhookQueue: () => ({ add: vi.fn() }),
}));

vi.mock('../../services/crm/CrmWebhookService.js', () => ({ crmWebhookService: { ingest: vi.fn() } }));
vi.mock('../../services/crm/CrmHealthService.js', () => ({ crmHealthService: { getHealth: vi.fn() } }));
vi.mock('../../middleware/auth.js', () => ({ requireAuth: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../middleware/tenantContext.js', () => ({ tenantContextMiddleware: () => (_req: any, _res: any, next: any) => next() }));
vi.mock('../../middleware/rbac.js', () => ({ requirePermission: () => (_req: any, _res: any, next: any) => next() }));
vi.mock('../../middleware/rateLimiter.js', () => ({ createRateLimiter: () => (_req: any, _res: any, next: any) => next() }));
vi.mock('../../security/securityLogger.js', () => ({ logSecurityEvent }));

async function get(app: express.Express, path: string) {
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('CRM OAuth callback state validation', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use('/api/crm', crmRouter);
  });

  it('rejects replayed state nonce', async () => {
    consumeOAuthStateOnce.mockRejectedValueOnce(new Error('OAuth state not found or already consumed'));

    const response = await get(app, '/api/crm/salesforce/connect/callback?code=test-code&state=replayed-nonce');

    expect(response.status).toBe(400);
    expect(completeOAuth).not.toHaveBeenCalled();
    expect(logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'OAuth state not found or already consumed',
      metadata: expect.objectContaining({ reasonCode: 'invalid_oauth_state' }),
    }));
  });

  it('rejects wrong-provider state', async () => {
    consumeOAuthStateOnce.mockRejectedValueOnce(new Error('OAuth state provider mismatch'));

    const response = await get(app, '/api/crm/hubspot/connect/callback?code=test-code&state=nonce-1');

    expect(response.status).toBe(400);
    expect(completeOAuth).not.toHaveBeenCalled();
  });

  it('rejects expired state', async () => {
    consumeOAuthStateOnce.mockRejectedValueOnce(new Error('OAuth state expired'));

    const response = await get(app, '/api/crm/salesforce/connect/callback?code=test-code&state=expired-nonce');

    expect(response.status).toBe(400);
    expect(completeOAuth).not.toHaveBeenCalled();
  });

  it('rejects tenant-mismatched completion result', async () => {
    consumeOAuthStateOnce.mockResolvedValueOnce({
      nonce: 'nonce-2',
      tenantId: 'tenant-from-state',
      userId: 'user-1',
      provider: 'salesforce',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    completeOAuth.mockResolvedValueOnce({ id: 'conn-1', tenant_id: 'different-tenant', provider: 'salesforce', status: 'connected' });

    const response = await get(app, '/api/crm/salesforce/connect/callback?code=test-code&state=nonce-2');

    expect(response.status).toBe(400);
    expect(logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'OAuth state tenant mismatch',
      metadata: expect.objectContaining({ reasonCode: 'invalid_oauth_state' }),
    }));
  });
});
