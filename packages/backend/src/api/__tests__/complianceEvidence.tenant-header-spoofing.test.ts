import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { appendEvidenceMock, verifyEvidenceChainMock, exportEvidenceMock } = vi.hoisted(() => ({
  appendEvidenceMock: vi.fn().mockResolvedValue({ id: 'record-1' }),
  verifyEvidenceChainMock: vi.fn().mockResolvedValue({ valid: true }),
  exportEvidenceMock: vi.fn().mockResolvedValue('{}'),
}));

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/tenantContext.js', () => ({
  tenantContextMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../services/security/ComplianceEvidenceService.js', () => ({
  complianceEvidenceService: {
    appendEvidence: appendEvidenceMock,
    verifyEvidenceChain: verifyEvidenceChainMock,
    exportEvidence: exportEvidenceMock,
  },
}));

import { complianceEvidenceRouter } from '../complianceEvidence.js';

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/compliance-evidence', complianceEvidenceRouter);
  return app;
}

describe('complianceEvidenceRouter tenant trust boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects append requests when trusted tenant context is absent, even with spoofed x-tenant-id header', async () => {
    const app = makeApp();

    const response = await request(app)
      .post('/api/compliance-evidence/append')
      .set('x-tenant-id', 'spoofed-tenant')
      .send({
        actor_principal: 'user-1',
        actor_type: 'user',
        trigger_type: 'event',
        trigger_source: 'unit-test',
        evidence: { check: 'ok' },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Trusted tenant context is required');
    expect(appendEvidenceMock).not.toHaveBeenCalled();
  });

  it('rejects verify requests when trusted tenant context is absent, even with spoofed x-organization-id header', async () => {
    const app = makeApp();

    const response = await request(app)
      .get('/api/compliance-evidence/verify')
      .set('x-organization-id', 'spoofed-org');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Trusted tenant context is required');
    expect(verifyEvidenceChainMock).not.toHaveBeenCalled();
  });
});
