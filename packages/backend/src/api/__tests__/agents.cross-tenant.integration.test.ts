import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import agentsRouter from '../../api/agents';
import { requireTenantRequestAlignment } from '../../middleware/auth.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.js';

const tenantVerificationMocks = vi.hoisted(() => ({
  getUserTenantId: vi.fn(),
  verifyTenantExists: vi.fn(),
  verifyTenantMembership: vi.fn(),
}));

vi.mock('@shared/lib/tenantVerification', () => tenantVerificationMocks);
vi.mock('../../services/EventProducer', () => ({
  getEventProducer: () => ({ publish: vi.fn() }),
}));

describe('Agent API tenant denial integration', () => {
  let app: express.Express;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TCT_SECRET = 'test-tct-secret';

    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: 'user-a', tenant_id: 'tenant-a' };
      req.tenantId = 'tenant-a';
      req.serviceIdentityVerified = true;
      next();
    });
    app.use('/api/agents', requireTenantRequestAlignment(), tenantContextMiddleware(), agentsRouter);

    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);
  });

  it('denies when tenant header targets another tenant', async () => {
    const res = await request(app)
      .post('/api/agents/execute')
      .set('x-tenant-id', 'tenant-b')
      .send({ type: 'IntegrityAgent:resolveIssue', data: { issueId: 'issue-1', resolution: 'accept' } })
      .expect(403);

    expect(res.body).toMatchObject({
      error: 'tenant_mismatch',
    });
  });

  it('denies when x-tenant-context token carries a different tenant', async () => {
    const tct = jwt.sign(
      {
        iss: 'service',
        sub: 'user-a',
        tid: 'tenant-b',
        roles: ['service'],
        tier: 'internal',
        exp: Math.floor(Date.now() / 1000) + 300,
      },
      'test-tct-secret',
      { algorithm: 'HS256' }
    );

    const res = await request(app)
      .post('/api/agents/execute')
      .set('x-tenant-context', tct)
      .send({
        tenant_id: 'tenant-a',
        type: 'IntegrityAgent:resolveIssue',
        data: { issueId: 'issue-1', resolution: 'accept' },
      })
      .expect(403);

    expect(res.body).toEqual({ error: 'Tenant context mismatch' });
  });
});
