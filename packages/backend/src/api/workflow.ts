import { Request, Response, Router } from 'express';
import { supabase } from '@shared/lib/supabase';
import { logger } from '@shared/lib/logger';
import { rateLimiters } from '../middleware/rateLimiter';
import { securityHeadersMiddleware } from '../middleware/securityMiddleware';
import { serviceIdentityMiddleware } from '../middleware/serviceIdentityMiddleware';
import { validateRequest } from '../middleware/inputValidation';
import { requirePermission } from '../middleware/rbac';
import { requireAuth } from '../middleware/auth';
import { tenantContextMiddleware } from '../middleware/tenantContext';

const router = Router();
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);
router.use(requireAuth);
router.use(tenantContextMiddleware());
router.use(requirePermission('agents.execute'));

const workflowExplainParamsSchema = {
  executionId: { type: 'string', required: true, minLength: 1, maxLength: 100 },
  stepId: { type: 'string', required: true, minLength: 1, maxLength: 100 },
};

function sanitizeEvidence(evidence: any): Array<{ source?: string; description?: string; confidence?: number }> {
  if (!Array.isArray(evidence)) return [];
  return evidence.map(item => ({
    source: item.source,
    description: item.description,
    confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
  }));
}

router.get(
  '/workflow/:executionId/step/:stepId/explain',
  rateLimiters.loose,
  validateRequest(workflowExplainParamsSchema, 'params'),
  async (req: Request, res: Response) => {
    const { executionId, stepId } = req.params;
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return res.status(403).json({
        error: 'tenant_required',
        message: 'Tenant context is required to access workflow execution logs',
      });
    }

    try {
      const { data, error } = await supabase
        .from('workflow_execution_logs')
        .select('execution_id, stage_id, output_data')
        .eq('execution_id', executionId)
        .eq('stage_id', stepId)
        .eq('tenant_id', tenantId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return res.status(404).json({
          error: 'not_found',
          message: 'No execution step was found for the provided identifiers',
        });
      }

      const output = (data.output_data as Record<string, any>) || {};
      const reasoning = output.reasoning || output.result?.reasoning || 'No reasoning captured for this step';
      const evidence = sanitizeEvidence(output.evidence || output.result?.evidence || []);
      const confidence =
        output.confidence_score ??
        output.confidence ??
        output.result?.confidence_score ??
        null;

      return res.json({
        success: true,
        data: {
          workflow_id: executionId,
          step_id: stepId,
          reasoning,
          evidence,
          confidence_score: confidence,
        },
      });
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
