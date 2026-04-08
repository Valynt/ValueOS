import { NextFunction, Request, Response, Router } from 'express';
import { ZodError } from 'zod';

import { AuthenticatedRequest, requireRole } from '../../middleware/auth.js';
import { ValueTreeRepository } from '../../repositories/ValueTreeRepository.js';
import { createWorkerServiceSupabaseClient } from '../../lib/supabase/privileged/index.js';
import {
  caseValueTreeService,
  ValueTreeNodeInputSchema,
} from '../../services/value/CaseValueTreeService.js';

import { validateUuidParam } from './middleware.js';
import { ValueCasesRouteLimiters } from './crud.routes.js';

export function registerValueTreeRoutes(
  router: Router,
  { standardLimiter }: Pick<ValueCasesRouteLimiters, 'standardLimiter'>,
): void {
  router.get(
    '/:caseId/value-tree',
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
        const supabase = createWorkerServiceSupabaseClient({
          justification: 'service-role:justified value tree repository access scoped to tenant',
        });
        const repo = new ValueTreeRepository(supabase);
        const nodes = await repo.getNodesForCase(caseId, organizationId);
        res.json({ data: nodes });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:caseId/value-tree',
    standardLimiter,
    requireRole(['admin', 'member']),
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
        const body = req.body as unknown;

        if (
          body !== null &&
          typeof body === 'object' &&
          'nodes' in body &&
          Array.isArray((body as Record<string, unknown>).nodes)
        ) {
          const { nodes } = body as { nodes: unknown[] };
          const validated = nodes.map((n) =>
            ValueTreeNodeInputSchema.omit({ case_id: true, organization_id: true }).parse(n),
          );
          const result = await caseValueTreeService.replaceTree(caseId, organizationId, validated);
          res.json({ data: result });
          return;
        }

        const node = ValueTreeNodeInputSchema.parse({
          ...(body as object),
          case_id: caseId,
          organization_id: organizationId,
        });
        const result = await caseValueTreeService.upsertNode(node);
        res.json({ data: result });
      } catch (err) {
        if (err instanceof ZodError) {
          res.status(400).json({ error: 'Invalid node data', details: err.errors });
          return;
        }
        next(err);
      }
    },
  );
}
