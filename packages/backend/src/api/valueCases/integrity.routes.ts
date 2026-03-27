import { NextFunction, Request, Response, Router } from 'express';

import { AuthenticatedRequest, requireRole } from '../../middleware/auth.js';
import { integrityOutputRepository } from '../../repositories/IntegrityOutputRepository.js';
import { ReadinessScorer } from '../../services/integrity/ReadinessScorer.js';

import { validateUuidParam } from './middleware.js';
import { ValueCasesRouteLimiters } from './crud.routes.js';

const readinessScorer = new ReadinessScorer();

export function registerIntegrityRoutes(
  router: Router,
  { standardLimiter }: Pick<ValueCasesRouteLimiters, 'standardLimiter'>,
): void {
  router.get(
    '/:caseId/integrity',
    standardLimiter,
    requireRole(['admin', 'member', 'viewer']),
    validateUuidParam('caseId'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const authReq = req as AuthenticatedRequest;
      const { caseId } = req.params;
      const organizationId = authReq.tenantId ?? authReq.user?.tenant_id as string | undefined;

      if (!organizationId) {
        res.status(401).json({ error: 'Missing tenant context' });
        return;
      }

      try {
        const output = await integrityOutputRepository.getForCase(caseId, organizationId);
        res.json({ data: output });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/:caseId/readiness',
    standardLimiter,
    requireRole(['admin', 'member', 'viewer']),
    validateUuidParam('caseId'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const authReq = req as AuthenticatedRequest;
      const { caseId } = req.params;
      const organizationId = authReq.tenantId ?? authReq.user?.tenant_id as string | undefined;

      if (!organizationId) {
        res.status(401).json({ error: 'Missing tenant context' });
        return;
      }

      try {
        const readiness = await readinessScorer.calculateReadiness(caseId, organizationId);
        res.json({ data: readiness });
      } catch (err) {
        next(err);
      }
    },
  );
}
