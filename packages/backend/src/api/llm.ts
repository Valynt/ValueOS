/**
 * LLM API Endpoints
 * 
 * Provides endpoints for LLM interactions with automatic fallback,
 * rate limiting, cost tracking, and caching.
 */

import { Request, Response, Router } from 'express';
import { llmFallback } from '../services/LLMFallback.js'
import { CostGovernanceError } from '../services/CostGovernanceService.js'
import { llmRateLimiter } from '../middleware/llmRateLimiter.js'
import { logger } from '../utils/logger.js'
import { FallbackAIService } from '../services/FallbackAIService.js'
import {
  csrfProtectionMiddleware,
  securityHeadersMiddleware,
  sessionTimeoutMiddleware,
} from '../middleware/securityMiddleware';
import { serviceIdentityMiddleware } from '../middleware/serviceIdentityMiddleware.js'
import { rateLimiters } from '../middleware/rateLimiter.js'
import { requestAuditMiddleware } from '../middleware/requestAuditMiddleware.js'
import { requireConsent } from '../middleware/consentMiddleware.js'
import { consentRegistry } from '../services/consentRegistry.js'
import { sanitizeAgentInput } from '../utils/security.js'
import { requireAuth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { tenantContextMiddleware } from '../middleware/tenantContext.js'
import { tenantDbContextMiddleware } from '../middleware/tenantDbContext.js'
import { assertKnownApprovedModel, MODEL_POLICY_VERSION, ModelDeniedError } from '../config/models.js'

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
    const { prompt, model, maxTokens, temperature, stream, dealId } = req.body;
    
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

    try {
      assertKnownApprovedModel(model);
    } catch (error) {
      if (error instanceof ModelDeniedError) {
        return res.status(error.status).json({
          error: 'Model denied',
          code: error.code,
          message: 'Requested model is not approved for this API',
          policyVersion: MODEL_POLICY_VERSION,
        });
      }
      throw error;
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
    const tenantId = (req as any).tenantId;
    
    logger.info(
      'LLM chat request received',
      withRequestContext(req, res, {
        userId,
        sessionId,
        tenantId,
        model,
        promptLength: sanitizedPrompt.length,
        stream: !!stream
      })
    );

    const useFallbackModel = Boolean((req as any).useFallbackModel);

    // If plan enforcement downgraded this request, route to fallback immediately.
    if (useFallbackModel) {
      res.setHeader('X-LLM-Fallback', 'true');
      const fallbackContent = FallbackAIService.generateFallbackResponse(sanitizedPrompt);

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        res.write(`data: ${JSON.stringify({ content: fallbackContent, done: true, fallback: true })}\n\n`);
        return res.end();
        return;
      }

      return res.json({
        success: true,
        data: {
          content: fallbackContent,
          provider: 'fallback',
          model: 'fallback',
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
          },
          cost: 0,
          latency: 0,
          cached: false,
          fallback: true
        }
      });
    }

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
          sessionId,
          tenantId,
          dealId
        });

        for await (const chunk of streamGenerator) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        return res.end();
      } catch (error) {
        logger.error('LLM stream failed', error as Error, withRequestContext(req, res));
        const message =
          error instanceof CostGovernanceError
            ? error.message
            : "Stream failed";
        // Send error event
        res.write(
          `data: ${JSON.stringify({ error: message, done: true })}\n\n`
        );
        return res.end();
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
      sessionId,
      tenantId,
      dealId
    });
    
    // Return response
    return res.json({
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
    if (error instanceof CostGovernanceError) {
      return res.status(429).json({
        error: "Cost governance limit exceeded",
        message: error.message,
        details: error.snapshot,
      });
    }

    if (error instanceof ModelDeniedError) {
      return res.status(error.status).json({
        error: 'Model denied',
        code: error.code,
        message: 'Requested model is not approved for this API',
        policyVersion: MODEL_POLICY_VERSION,
      });
    }

    logger.error('LLM chat request failed', error as Error, withRequestContext(req, res));
    
    return res.status(500).json({
      error: 'LLM request failed',
      message: 'An internal error occurred while processing the request'
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
    const stats = await llmFallback.getStats();
    
    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get LLM stats', error as Error, withRequestContext(req, res));
    
    return res.status(500).json({
      error: 'Failed to get stats',
      message: 'An internal error occurred'
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
    
    return res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      data: health
    });
  } catch (error) {
    logger.error('LLM health check failed', error as Error, withRequestContext(req, res));
    
    return res.status(500).json({
      error: 'Health check failed',
      message: 'An internal error occurred'
    });
  }
});

/**
 * POST /api/llm/reset
 * 
 * Reset circuit breakers (admin only)
 */
router.post('/reset', rateLimiters.strict, csrfProtectionMiddleware, sessionTimeoutMiddleware, requirePermission('admin:manage'), async (req: Request, res: Response) => {
  try {
    llmFallback.reset();
    
    logger.info(
      'Circuit breakers reset by admin',
      withRequestContext(req, res, {
        userId: (req as any).user?.id,
      })
    );
    
    return res.json({
      success: true,
      message: 'Circuit breakers reset successfully'
    });
  } catch (error) {
    logger.error('Failed to reset circuit breakers', error as Error, withRequestContext(req, res));
    
    return res.status(500).json({
      error: 'Reset failed',
      message: 'An internal error occurred'
    });
  }
});

export default router;
