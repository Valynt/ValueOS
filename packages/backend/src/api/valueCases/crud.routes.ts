import { NextFunction, Request, Response, Router, RequestHandler } from 'express';

import { logger } from '../../lib/logger.js';
import { AuthenticatedRequest, requireRole } from '../../middleware/auth.js';
import { FinancialModelSnapshotRepository } from '../../repositories/FinancialModelSnapshotRepository.js';
import { hypothesisOutputService } from '../../services/value/HypothesisOutputService.js';

import { ValueCasesRepository } from './repository';
import {
  CreateValueCaseSchema,
  ListValueCasesQuerySchema,
  UpdateValueCaseSchema,
} from './types';
import { validateBody, validateQuery, validateUuidParam } from './middleware.js';

export type ValueCasesRouteLimiters = {
  standardLimiter: RequestHandler;
  strictLimiter: RequestHandler;
};

async function createCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  try {
    const repository = ValueCasesRepository.fromRequest(req);
    const valueCase = await repository.create(
      authReq.tenantId!,
      authReq.user!.id,
      req.body,
    );

    res.status(201).json({
      data: valueCase,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

async function listCases(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  try {
    const repository = ValueCasesRepository.fromRequest(req);
    const result = await repository.list(authReq.tenantId!, ListValueCasesQuerySchema.parse(req.query));

    res.status(200).json({
      ...result,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

async function getCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;

  try {
    const repository = ValueCasesRepository.fromRequest(req);
    const valueCase = await repository.getById(authReq.tenantId!, caseId);

    res.status(200).json({
      data: valueCase,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

async function updateCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;

  try {
    const requestedStatus = (req.body as Record<string, unknown>)?.status;
    if (requestedStatus === 'in_review') {
      const organizationId = authReq.tenantId ?? authReq.organizationId;
      if (!req.supabase) {
        logger.warn('Integrity gate skipped: req.supabase not available', { caseId });
      } else if (organizationId) {
        try {
          const { valueIntegrityService } = await import(
            '../../services/integrity/ValueIntegrityService.js'
          );
          const accessToken =
            (req.headers.authorization?.replace('Bearer ', '') ?? '');
          const blockResult = await valueIntegrityService.checkHardBlocks(
            caseId,
            organizationId,
            accessToken,
          );
          if (blockResult.blocked) {
            res.status(422).json({
              error: 'IntegrityHardBlock',
              message: 'This case has open critical integrity violations that must be resolved before advancing to in_review.',
              blocked: true,
              violations: blockResult.violations,
              soft_warnings: blockResult.soft_warnings,
            });
            return;
          }
        } catch (integrityErr) {
          logger.warn('Integrity gate check failed — proceeding without gate', {
            caseId,
            error: integrityErr instanceof Error ? integrityErr.message : String(integrityErr),
          });
        }
      }
    }

    const repository = ValueCasesRepository.fromRequest(req);
    const valueCase = await repository.update(authReq.tenantId!, caseId, req.body);

    res.status(200).json({
      data: valueCase,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

async function deleteCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;

  try {
    const repository = ValueCasesRepository.fromRequest(req);
    await repository.delete(authReq.tenantId!, caseId);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export function registerCrudRoutes(
  router: Router,
  { standardLimiter, strictLimiter }: ValueCasesRouteLimiters,
): void {
  router.post(
    '/',
    strictLimiter,
    requireRole(['admin', 'member']),
    validateBody(CreateValueCaseSchema),
    createCase,
  );

  router.get(
    '/',
    standardLimiter,
    requireRole(['admin', 'member', 'viewer']),
    validateQuery(ListValueCasesQuerySchema),
    listCases,
  );

  router.get(
    '/:caseId',
    standardLimiter,
    requireRole(['admin', 'member', 'viewer']),
    validateUuidParam('caseId'),
    getCase,
  );

  router.patch(
    '/:caseId',
    standardLimiter,
    requireRole(['admin', 'member']),
    validateUuidParam('caseId'),
    validateBody(UpdateValueCaseSchema),
    updateCase,
  );

  router.delete(
    '/:caseId',
    strictLimiter,
    requireRole(['admin']),
    validateUuidParam('caseId'),
    deleteCase,
  );

  router.get(
    '/:caseId/hypothesis',
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
        const output = await hypothesisOutputService.getLatestForCase(caseId, organizationId);
        if (!output) {
          res.status(404).json({ data: null, message: 'No hypothesis output found for this case' });
          return;
        }
        res.json({ data: output });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/:caseId/model-snapshots/latest',
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
        const repo = new FinancialModelSnapshotRepository();
        const snapshot = await repo.getLatestSnapshotForCase(caseId, organizationId);
        if (!snapshot) {
          res.status(404).json({ data: null, message: 'No financial model snapshot found for this case' });
          return;
        }
        res.json({ data: snapshot });
      } catch (err) {
        next(err);
      }
    },
  );
}
