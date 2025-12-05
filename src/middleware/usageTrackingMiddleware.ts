/**
 * Usage Tracking Middleware
 * Emits usage events after requests complete
 */

import { Request, Response, NextFunction } from 'express';
import UsageEmitter from '../services/metering/UsageEmitter';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../lib/logger';

const logger = createLogger({ component: 'UsageTrackingMiddleware' });

/**
 * Track API calls
 */
export function trackAPICall(req: Request, res: Response, next: NextFunction) {
  const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] as string;
  
  if (!tenantId) {
    return next();
  }

  // Track on response finish
  res.on('finish', () => {
    if (res.statusCode < 500) {
      // Only count successful requests
      const requestId = req.headers['x-request-id'] as string || uuidv4();
      const endpoint = req.path;

      UsageEmitter.emitAPICall(tenantId, requestId, endpoint)
        .catch(error => {
          logger.error('Failed to emit API call', error);
        });
    }
  });

  next();
}

/**
 * Track LLM usage from response
 */
export function trackLLMUsage(tokens: number, model?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return next();
    }

    res.on('finish', () => {
      if (res.statusCode === 200) {
        const requestId = req.headers['x-request-id'] as string || uuidv4();

        UsageEmitter.emitLLMTokens(tenantId, tokens, requestId, model)
          .catch(error => {
            logger.error('Failed to emit LLM usage', error);
          });
      }
    });

    next();
  };
}

/**
 * Track agent execution
 */
export function trackAgentExecution(agentType?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return next();
    }

    res.on('finish', () => {
      if (res.statusCode === 200) {
        const requestId = req.headers['x-request-id'] as string || uuidv4();

        UsageEmitter.emitAgentExecution(tenantId, requestId, agentType)
          .catch(error => {
            logger.error('Failed to emit agent execution', error);
          });
      }
    });

    next();
  };
}

export default {
  trackAPICall,
  trackLLMUsage,
  trackAgentExecution,
};
