/**
 * Queue API Endpoints
 *
 * Endpoints for async LLM job management
 */

import { Request, Response, Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { requireConsent, resolveAuthenticatedConsentContext } from '../middleware/consentMiddleware.js';
import { rateLimiters } from '../middleware/rateLimiter.js';
import { requestAuditMiddleware } from '../middleware/requestAuditMiddleware.js';
import {
  csrfProtectionMiddleware,
  securityHeadersMiddleware,
  sessionTimeoutMiddleware,
} from '../middleware/securityMiddleware';
import { serviceIdentityMiddleware } from '../middleware/serviceIdentityMiddleware.js';
import { consentRegistry } from '../services/auth/consentRegistry.js';
import { llmQueue } from '../services/realtime/MessageQueue.js';
import { logger } from '../utils/logger.js';
import { sanitizeAgentInput } from '../utils/security.js';

const router = Router();
router.use(requestAuditMiddleware());
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);
router.use(requireAuth);

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: req.requestId || res.locals.requestId,
  ...meta,
});

/**
 * POST /api/queue/llm
 *
 * Submit LLM job to queue
 */
router.post(
  '/llm',
  rateLimiters.standard,
  csrfProtectionMiddleware,
  sessionTimeoutMiddleware,
  requireConsent('queue.llm', consentRegistry, resolveAuthenticatedConsentContext),
  async (req: Request, res: Response) => {
    try {
      const { type, promptKey, promptVariables, prompt, model, maxTokens, temperature, metadata } = req.body;

      // Validate request
      if (!type) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Type is required'
        });
      }

      if (!promptKey && !prompt) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Either promptKey or prompt is required'
        });
      }

      // Get user info
      const userId = req.user?.id || 'anonymous';
      const sessionId = req.sessionId;

      const promptSanitization = prompt ? sanitizeAgentInput(prompt) : null;
      const variablesSanitization = promptVariables ? sanitizeAgentInput(promptVariables) : null;

      if ((promptSanitization && !promptSanitization.safe) || (variablesSanitization && !variablesSanitization.safe)) {
        logger.warn('Blocked unsafe queued LLM prompt', {
          severity: promptSanitization?.severity || variablesSanitization?.severity,
          violations: promptSanitization?.violations || variablesSanitization?.violations,
          requestId: withRequestContext(req, res).requestId,
        });

        return res.status(400).json({
          error: 'Invalid request',
          message: 'Prompt rejected due to unsafe content'
        });
      }

      const sanitizedPrompt = promptSanitization ? promptSanitization.sanitized : undefined;
      const sanitizedPromptVariables =
        variablesSanitization && typeof variablesSanitization.sanitized === 'object' && variablesSanitization.sanitized !== null
          ? variablesSanitization.sanitized as Record<string, unknown>
          : undefined;

      // Add job to queue
      const job = await llmQueue.addJob({
        type,
        userId,
        sessionId,
        promptKey,
        promptVariables: sanitizedPromptVariables,
        prompt: typeof sanitizedPrompt === 'string' ? sanitizedPrompt : undefined,
        model,
        maxTokens,
        temperature,
        metadata: typeof metadata === 'object' && metadata !== null ? metadata as Record<string, unknown> : undefined,
      });

      logger.info(
        'LLM job submitted',
        withRequestContext(req, res, {
          jobId: job.id,
          type,
          userId,
        })
      );

      return res.status(202).json({
        success: true,
        data: {
          jobId: job.id,
          status: 'queued',
          statusUrl: `/api/queue/llm/${job.id}`
        }
      });
    } catch (error) {
      logger.error('Failed to submit LLM job', error as Error, withRequestContext(req, res));

      return res.status(500).json({
        error: 'Failed to submit job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/queue/llm/:jobId
 *
 * Get job status
 */
router.get('/llm/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const status = await llmQueue.getJobStatus(jobId);

    if (status.status === 'not_found') {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job ${jobId} not found`
      });
    }

    return res.json({
      success: true,
      data: {
        jobId,
        ...status
      }
    });
  } catch (error) {
    logger.error('Failed to get job status', error as Error, withRequestContext(req, res));

    return res.status(500).json({
      error: 'Failed to get job status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/queue/llm/:jobId/result
 *
 * Get job result
 */
router.get('/llm/:jobId/result', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const result = await llmQueue.getJobResult(jobId);

    if (!result) {
      return res.status(404).json({
        error: 'Result not found',
        message: `Result for job ${jobId} not found`
      });
    }

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to get job result', error as Error, withRequestContext(req, res));

    return res.status(500).json({
      error: 'Failed to get job result',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/queue/llm/:jobId
 *
 * Cancel job
 */
router.delete(
  '/llm/:jobId',
  rateLimiters.standard,
  csrfProtectionMiddleware,
  sessionTimeoutMiddleware,
  requireConsent('queue.llm.cancel', consentRegistry, resolveAuthenticatedConsentContext),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;

      await llmQueue.cancelJob(jobId);

      logger.info(
        'LLM job cancelled',
        withRequestContext(req, res, {
          jobId,
          userId: req.user?.id,
        })
      );

      return res.json({
        success: true,
        message: 'Job cancelled'
      });
    } catch (error) {
      logger.error('Failed to cancel job', error as Error, withRequestContext(req, res));

      return res.status(500).json({
        error: 'Failed to cancel job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/queue/metrics
 *
 * Get queue metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await llmQueue.getMetrics();

    return res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get queue metrics', error as Error, withRequestContext(req, res));

    return res.status(500).json({
      error: 'Failed to get metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
