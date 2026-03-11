import { logger } from '@shared/lib/logger';
import { Request, Response, Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js'
import { validateRequest, type ValidationSchema } from '../middleware/inputValidation.js'
import { rateLimiters } from '../middleware/rateLimiter.js'
import { requirePermission } from '../middleware/rbac.js'
import { securityHeadersMiddleware } from '../middleware/securityMiddleware.js'
import { serviceIdentityMiddleware } from '../middleware/serviceIdentityMiddleware.js'
import { tenantContextMiddleware } from '../middleware/tenantContext.js'
import { tenantDbContextMiddleware } from '../middleware/tenantDbContext.js'
import { createBillingAccessEnforcement } from '../middleware/billingAccessEnforcement.js'
import {
  getTenantIdFromRequest,
  ReadThroughCacheService,
} from "../services/ReadThroughCacheService.js"
import { createExecutionRuntime } from '../runtime/execution-runtime/index.js';

const router = Router();
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);
router.use(requireAuth);
router.use(tenantContextMiddleware());
router.use(tenantDbContextMiddleware());
router.use(createBillingAccessEnforcement());
router.use(requirePermission('agents:execute'));

const workflowExplainParamsSchema: ValidationSchema = {
  executionId: { type: 'string', required: true, minLength: 1, maxLength: 100 },
  stepId: { type: 'string', required: true, minLength: 1, maxLength: 100 },
};

const executeWorkflowBodySchema = z.object({
  workflowId: z.string().min(1).optional(),
  workflowDefinitionId: z.string().min(1).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().min(1).max(500).optional(),
}).refine((body) => Boolean(body.workflowId || body.workflowDefinitionId), {
  message: 'workflowId or workflowDefinitionId is required',
});

type WorkflowRequestUser = {
  id?: string;
  role?: string;
};

type WorkflowExecuteRequest = Request & {
  tenantId?: string;
  user?: WorkflowRequestUser;
};

async function executeWorkflowHandler(req: WorkflowExecuteRequest, res: Response): Promise<Response> {
  const tenantId = getTenantIdFromRequest(req as unknown as { tenantId?: string; headers: Record<string, string | string[] | undefined> });
  const parseResult = executeWorkflowBodySchema.safeParse(req.body ?? {});

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'validation_error',
      message: parseResult.error.issues[0]?.message ?? 'Invalid workflow execution request payload',
    });
  }

  if (!tenantId) {
    return res.status(401).json({
      error: 'tenant_required',
      message: 'Tenant context is required to execute workflows',
    });
  }

  const payload = parseResult.data;
  const workflowDefinitionId = payload.workflowDefinitionId ?? payload.workflowId;
  const context = payload.input ?? payload.context ?? {};
  const actorId = req.user?.id ?? 'api-user';

  const executionEnvelope = {
    intent: 'execute_workflow',
    actor: {
      id: actorId,
      roles: req.user?.role ? [req.user.role] : undefined,
    },
    organizationId: tenantId,
    entryPoint: 'api.workflow.execute',
    reason: payload.reason ?? 'Workflow execution requested via API endpoint',
    timestamps: {
      requestedAt: new Date().toISOString(),
    },
  };

  try {
    const executionRuntime = createExecutionRuntime();
    const result = await executionRuntime.executeWorkflow(
      executionEnvelope,
      workflowDefinitionId as string,
      context,
      actorId,
    );

    return res.status(202).json({
      success: true,
      data: {
        executionId: result.executionId,
        workflowDefinitionId: workflowDefinitionId!,
        status: result.status,
        currentStage: result.currentStage,
        completedStages: result.completedStages,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to execute workflow';
    const statusCode = message.includes('not found') ? 404 : 500;

    logger.error('Failed to execute workflow', error instanceof Error ? error : undefined, {
      tenantId,
      workflowDefinitionId: workflowDefinitionId!,
    });

    return res.status(statusCode).json({
      error: 'workflow_execution_failed',
      message,
    });
  }
}

router.post('/workflows/execute', rateLimiters.standard, executeWorkflowHandler);
router.post('/workflow/execute', rateLimiters.standard, executeWorkflowHandler);

router.get(
  '/workflows/:id',
  rateLimiters.standard,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    // Use a fixed prefix that cannot collide with real UUID tenant IDs.
    const tenantId = getTenantIdFromRequest(req as any) ?? "__anon__";

    const payload = await ReadThroughCacheService.getOrLoad(
      {
        tenantId,
        endpoint: "api-workflows-detail",
        scope: id,
        tier: "hot",
      },
      async () => {
        // Mock response until persistence layer is ready
        const workflow = {
          id,
          name: "Untitled Workflow",
          status: "draft",
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return {
          success: true,
          data: workflow,
        };
      }
    );

    return res.json(payload);
  }
);

type WorkflowEvidenceItem = {
  source?: string;
  description?: string;
  confidence?: number;
};


function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function sanitizeEvidence(evidence: unknown): WorkflowEvidenceItem[] {
  if (!Array.isArray(evidence)) return [];
  return evidence.map((item) => {
    const candidate = (item ?? {}) as Record<string, unknown>;
    return {
      source: typeof candidate.source === 'string' ? candidate.source : undefined,
      description: typeof candidate.description === 'string' ? candidate.description : undefined,
      confidence: typeof candidate.confidence === 'number' ? candidate.confidence : undefined,
    };
  });
}

router.get(
  '/workflow/:executionId/step/:stepId/explain',
  rateLimiters.loose,
  validateRequest(workflowExplainParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    const { executionId, stepId } = req.params;
    const tenantId = (req as any).tenantId;
    const db = (req as any).db as { query?: (query: string, params?: unknown[]) => Promise<{ rows?: Array<{ output_data?: unknown }> }> } | undefined;

    if (!tenantId) {
      return res.status(403).json({
        error: 'tenant_required',
        message: 'Tenant context is required to access workflow execution logs',
      });
    }

    if (!db?.query) {
      return res.status(500).json({
        error: 'tenant_db_unavailable',
        message: 'Tenant database context is required to access workflow execution logs',
      });
    }

    try {
      const { rows } = await db.query(
        `SELECT execution_id, stage_id, output_data
         FROM workflow_execution_logs
         WHERE execution_id = $1
           AND stage_id = $2
           AND tenant_id = $3
         ORDER BY started_at DESC
         LIMIT 1`,
        [executionId, stepId, tenantId]
      );

      const data = rows?.[0];

      if (!data) {
        return res.status(404).json({
          error: 'not_found',
          message: 'No execution step was found for the provided identifiers',
        });
      }

      const output = asRecord(data.output_data);
      const nestedResult = asRecord(output.result);
      const reasoning =
        (typeof output.reasoning === 'string' ? output.reasoning : undefined) ||
        (typeof nestedResult.reasoning === 'string' ? nestedResult.reasoning : undefined) ||
        'No reasoning captured for this step';
      const evidence = sanitizeEvidence(output.evidence ?? nestedResult.evidence ?? []);
      const confidence =
        (typeof output.confidence_score === 'number' ? output.confidence_score : undefined) ??
        (typeof output.confidence === 'number' ? output.confidence : undefined) ??
        (typeof nestedResult.confidence_score === 'number' ? nestedResult.confidence_score : undefined) ??
        null;

      const payload = await ReadThroughCacheService.getOrLoad(
        {
          tenantId,
          endpoint: "api-workflows-explain",
          scope: `${executionId}:${stepId}`,
          tier: "hot",
          keyPayload: { confidence, evidenceCount: evidence.length },
        },
        async () => ({
          success: true,
          data: {
            workflow_id: executionId,
            step_id: stepId,
            reasoning,
            evidence,
            confidence_score: confidence,
          },
        })
      );

      return res.json(payload);
    } catch (err) {
      logger.error('Failed to generate workflow explanation', err instanceof Error ? err : undefined, {
        executionId,
        stepId,
      });

      return res.status(500).json({
        error: 'explanation_failure',
        message: 'Unable to generate explanation for this workflow step',
      });
    }
  }
);

export default router;
