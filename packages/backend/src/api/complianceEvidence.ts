import { Request, Response, Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { complianceEvidenceService } from '../services/ComplianceEvidenceService.js';

export const complianceEvidenceRouter = Router();
complianceEvidenceRouter.use(requireAuth, tenantContextMiddleware());

const appendEvidenceSchema = z.object({
  actor_principal: z.string().min(1),
  actor_type: z.enum(['system', 'user', 'service']),
  trigger_type: z.enum(['scheduled', 'event']),
  trigger_source: z.string().min(1),
  collected_at: z.string().datetime().optional(),
  evidence: z.record(z.string(), z.unknown()),
});

function getTenantId(req: Request): string {
  const tenantId = (req as Request & { tenantId?: string; organizationId?: string }).tenantId
    ?? (req as Request & { tenantId?: string; organizationId?: string }).organizationId
    ?? (req.headers['x-tenant-id'] as string | undefined)
    ?? (req.headers['x-organization-id'] as string | undefined);

  if (!tenantId) {
    throw new Error('tenant_id is required');
  }

  return tenantId;
}

complianceEvidenceRouter.post('/append', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const payload = appendEvidenceSchema.parse(req.body);

    const record = await complianceEvidenceService.appendEvidence({
      tenantId,
      actorPrincipal: payload.actor_principal,
      actorType: payload.actor_type,
      triggerType: payload.trigger_type,
      triggerSource: payload.trigger_source,
      collectedAt: payload.collected_at,
      evidence: payload.evidence,
    });

    res.status(201).json({ success: true, record });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to append evidence',
    });
  }
});

complianceEvidenceRouter.get('/verify', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const result = await complianceEvidenceService.verifyEvidenceChain(tenantId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify evidence',
    });
  }
});

complianceEvidenceRouter.get('/export', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const format = req.query.format === 'csv' ? 'csv' : 'json';

    const data = await complianceEvidenceService.exportEvidence(tenantId, format);
    res
      .status(200)
      .setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json')
      .send(data);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export evidence',
    });
  }
});

