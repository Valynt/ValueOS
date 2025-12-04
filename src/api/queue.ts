/**
 * Queue API Endpoints
 * 
 * Endpoints for async LLM job management
 */

import { Router, Request, Response } from 'express';
import { llmQueue } from '../services/MessageQueue';
import { logger } from '../utils/logger';
import {
  csrfProtectionMiddleware,
  securityHeadersMiddleware,
  sessionTimeoutMiddleware,
} from '../middleware/securityMiddleware';
import { serviceIdentityMiddleware } from '../middleware/serviceIdentityMiddleware';
import { rateLimiters } from '../middleware/rateLimiter';
import { requestAuditMiddleware } from '../middleware/requestAuditMiddleware';

const router = Router();
router.use(requestAuditMiddleware());
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: (req as any).requestId || res.locals.requestId,
  ...meta,
});

/**
 * POST /api/queue/llm
 * 
 * Submit LLM job to queue
 */
router.post('/llm', rateLimiters.standard, csrfProtectionMiddleware, sessionTimeoutMiddleware, async (req: Request, res: Response) => {
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
    const userId = (req as any).user?.id || 'anonymous';
    const sessionId = (req as any).sessionId;
    
    // Add job to queue
    const job = await llmQueue.addJob({
      type,
      userId,
      sessionId,
      promptKey,
      promptVariables,
      prompt,
      model,
      maxTokens,
      temperature,
      metadata
    });
    
    logger.info(
      'LLM job submitted',
      withRequestContext(req, res, {
        jobId: job.id,
        type,
        userId,
      })
    );
    
    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        status: 'queued',
        statusUrl: `/api/queue/llm/${job.id}`
      }
    });
  } catch (error) {
    logger.error('Failed to submit LLM job', error as Error, withRequestContext(req, res));
    
    res.status(500).json({
      error: 'Failed to submit job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

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
    
    res.json({
      success: true,
      data: {
        jobId,
        ...status
      }
    });
  } catch (error) {
    logger.error('Failed to get job status', error as Error, withRequestContext(req, res));
    
    res.status(500).json({
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
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to get job result', error as Error, withRequestContext(req, res));
    
    res.status(500).json({
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
router.delete('/llm/:jobId', rateLimiters.standard, csrfProtectionMiddleware, sessionTimeoutMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    await llmQueue.cancelJob(jobId);
    
    logger.info(
      'LLM job cancelled',
      withRequestContext(req, res, {
        jobId,
        userId: (req as any).user?.id,
      })
    );
    
    res.json({
      success: true,
      message: 'Job cancelled'
    });
  } catch (error) {
    logger.error('Failed to cancel job', error as Error, withRequestContext(req, res));
    
    res.status(500).json({
      error: 'Failed to cancel job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/queue/metrics
 * 
 * Get queue metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await llmQueue.getMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get queue metrics', error as Error, withRequestContext(req, res));
    
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/queue/llm/batch
 * 
 * Submit batch of LLM jobs
 */
router.post('/llm/batch', rateLimiters.strict, csrfProtectionMiddleware, sessionTimeoutMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobs } = req.body;
    
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Jobs array is required'
      });
    }
    
    if (jobs.length > 100) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Maximum 100 jobs per batch'
      });
    }
    
    const userId = (req as any).user?.id || 'anonymous';
    const sessionId = (req as any).sessionId;
    
    const submittedJobs = await Promise.all(
      jobs.map(async (jobData, index) => {
        const job = await llmQueue.addJob({
          ...jobData,
          userId,
          sessionId
        }, {
          priority: index // Maintain order
        });
        
        return {
          jobId: job.id,
          status: 'queued'
        };
      })
    );
    
    logger.info(
      'Batch LLM jobs submitted',
      withRequestContext(req, res, {
        count: jobs.length,
        userId,
      })
    );
    
    res.status(202).json({
      success: true,
      data: {
        jobs: submittedJobs,
        batchId: `batch_${Date.now()}`
      }
    });
  } catch (error) {
    logger.error('Failed to submit batch jobs', error as Error, withRequestContext(req, res));
    
    res.status(500).json({
      error: 'Failed to submit batch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
