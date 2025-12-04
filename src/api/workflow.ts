import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { rateLimiters } from '../middleware/rateLimiter';
import { securityHeadersMiddleware } from '../middleware/securityMiddleware';
import { serviceIdentityMiddleware } from '../middleware/serviceIdentityMiddleware';

const router = Router();
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);

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
  async (req: Request, res: Response) => {
    const { executionId, stepId } = req.params;

    try {
      const { data, error } = await supabase
        .from('workflow_execution_logs')
        .select('execution_id, stage_id, output_data')
        .eq('execution_id', executionId)
        .eq('stage_id', stepId)
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
