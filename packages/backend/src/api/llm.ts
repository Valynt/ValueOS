/**
 * LLM API Endpoints
 * 
 * Provides endpoints for LLM interactions with automatic fallback,
 * rate limiting, cost tracking, and caching.
 */

import { Request, Response, Router } from 'express';
import { llmFallback } from '../services/LLMFallback';
import { llmRateLimiter } from '../middleware/llmRateLimiter';
import { logger } from '../utils/logger';
import {
  csrfProtectionMiddleware,
  securityHeadersMiddleware,
  sessionTimeoutMiddleware,
} from '../middleware/securityMiddleware';
import { serviceIdentityMiddleware } from '../middleware/serviceIdentityMiddleware';
import { rateLimiters } from '../middleware/rateLimiter';
import { requestAuditMiddleware } from '../middleware/requestAuditMiddleware';
import { requireConsent } from '../middleware/consentMiddleware';
import { consentRegistry } from '../services/consentRegistry';
import { sanitizeAgentInput } from '../utils/security';
import { requireAuth } from '../middleware/auth';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { tenantDbContextMiddleware } from '../middleware/tenantDbContext';

const router = Router();
router.use(requestAuditMiddleware());
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);
router.use(requireAuth);
router.use(tenantContextMiddleware(), tenantDbContextMiddleware());

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: (req as any).requestId || res.locals.requestId,
  ...meta,
});

/**
 * POST /api/llm/chat
 * 
 * Send a chat completion request to LLM with automatic fallback
 */
router.post(
  '/chat',
  rateLimiters.agentExecution,
  csrfProtectionMiddleware,
  sessionTimeoutMiddleware,
  requireConsent('llm.chat', consentRegistry),
  llmRateLimiter,
  async (req: Request, res: Response) => {
  try {
    const { prompt, model, maxTokens, temperature, stream } = req.body;
    
    // Validate request
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Prompt is required and must be a string'
      });
    }
    
    if (!model || typeof model !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Model is required and must be a string'
      });
    }

    const { sanitized, safe, severity, violations } = sanitizeAgentInput(prompt);
    const sanitizedPrompt = typeof sanitized === 'string' ? sanitized : String(sanitized);

    if (!safe) {
      logger.warn('Blocked unsafe LLM chat prompt', {
        severity,
        violations,
        requestId: withRequestContext(req, res).requestId,
      });

      return res.status(400).json({
        error: 'Invalid request',
        message: 'Prompt rejected due to unsafe content',
      });
    }

    // Get user info from auth middleware (assumed to be set)
    const userId = (req as any).user?.id || 'anonymous';
    const sessionId = (req as any).sessionId;
    
    logger.info(
      'LLM chat request received',
      withRequestContext(req, res, {
        userId,
        sessionId,
        model,
        promptLength: sanitizedPrompt.length,
        stream: !!stream
      })
    );

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        const streamGenerator = llmFallback.streamRequest({
          prompt: sanitizedPrompt,
          model,
          maxTokens,
          temperature,
          userId,
          sessionId
        });

        for await (const chunk of streamGenerator) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        res.end();
      } catch (error) {
        logger.error('LLM stream failed', error as Error, withRequestContext(req, res));
        // Send error event
        res.write(`data: ${JSON.stringify({ error: 'Stream failed', done: true })}\n\n`);
        res.end();
      }
      return;
    }

    // Process request with fallback
    const response = await llmFallback.processRequest({
      prompt: sanitizedPrompt,
      model,
      maxTokens,
      temperature,
      userId,
      sessionId
    });
    
    // Return response
    res.json({
      success: true,
      data: {
        content: response.content,
        provider: response.provider,
        model: response.model,
        usage: {
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens
        },
        cost: response.cost,
        latency: response.latency,
        cached: response.cached
      }
    });
  } catch (error) {
    logger.error('LLM chat request failed', error as Error, withRequestContext(req, res));
    
    res.status(500).json({
      error: 'LLM request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  }
);

/**
 * GET /api/llm/stats
 * 
 * Get LLM service statistics
 */
router.get('/stats', rateLimiters.loose, async (req: Request, res: Response) => {
  try {
    const stats = llmFallback.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get LLM stats', error as Error, withRequestContext(req, res));
    
    res.status(500).json({
      error: 'Failed to get stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/llm/health
 * 
 * Check LLM service health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await llmFallback.healthCheck();
    
    const allHealthy = health.togetherAI.healthy && health.openAI.healthy;
    
    res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      data: health
    });
  } catch (error) {
    logger.error('LLM health check failed', error as Error, withRequestContext(req, res));
    
    res.status(500).json({
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/llm/reset
 * 
 * Reset circuit breakers (admin only)
 */
router.post('/reset', rateLimiters.strict, csrfProtectionMiddleware, sessionTimeoutMiddleware, async (req: Request, res: Response) => {
  try {
    // Check admin permission (assumed to be set by auth middleware)
    const isAdmin = (req as any).user?.role === 'admin';
    
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required'
      });
    }
    
    llmFallback.reset();
    
    logger.info(
      'Circuit breakers reset by admin',
      withRequestContext(req, res, {
        userId: (req as any).user?.id,
      })
    );
    
    res.json({
      success: true,
      message: 'Circuit breakers reset successfully'
    });
  } catch (error) {
    logger.error('Failed to reset circuit breakers', error as Error, withRequestContext(req, res));
    
    res.status(500).json({
      error: 'Reset failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
