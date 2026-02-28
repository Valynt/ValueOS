import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { tenantContextMiddleware } from '../../middleware/tenantContext.js'

const tenantVerificationMocks = vi.hoisted(() => ({
  getUserTenantId: vi.fn(),
  verifyTenantExists: vi.fn(),
  verifyTenantMembership: vi.fn(),
}));

vi.mock('@shared/lib/tenantVerification', () => tenantVerificationMocks);

function createApp(authenticatedTenantId?: string) {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    (req as unknown as { user: { id: string; tenant_id?: string; organization_id?: string; role: string } }).user = {
      id: 'user-a',
      tenant_id: authenticatedTenantId,
      organization_id: authenticatedTenantId,
      role: 'authenticated',
    };
    next();
  });

  app.post('/api/agents/execute', tenantContextMiddleware(), (_req, res) => {
    res.status(200).json({ success: true });
  });

  return app;
}

describe('agents tenant isolation integration', () => {
  it('denies cross-tenant header overrides for agent endpoints', async () => {
    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);

    const app = createApp('tenant-a');

    const response = await request(app)
      .post('/api/agents/execute')
      .set('x-tenant-id', 'tenant-b')
      .send({ type: 'TargetAgent:execute', data: { goal: 'test' } });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
      message: 'Agent tenant context must match authenticated tenant claims.',
    });
  });

  it('allows matching tenant claim context for agent endpoints', async () => {
    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);

    const app = createApp('tenant-a');

    const response = await request(app)
      .post('/api/agents/execute')
      .send({ type: 'TargetAgent:execute', data: { goal: 'test' } });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
