/**
 * Usage Tracking Middleware
 * Emits usage events after requests complete.
 */

import { createLogger } from '@shared/lib/logger';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { supabase } from '../lib/supabase.js';
import UsageEmitter from '../services/metering/UsageEmitter.js';

const logger = createLogger({ component: 'UsageTrackingMiddleware' });
const usageEmitter = new UsageEmitter(supabase);

const getEvidenceLink = (requestId: string): string => `api://${requestId}`;

export function trackAPICall(req: Request, res: Response, next: NextFunction) {
  const tenantId = (req as { tenantId?: string }).tenantId;

  if (!tenantId) {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode < 500) {
      const requestId = (req.headers['x-request-id'] as string) || uuidv4();
      const endpoint = req.path;

      usageEmitter.emitAPICall(tenantId, requestId, endpoint, getEvidenceLink(requestId)).catch((error) => {
        logger.error('Failed to emit API call', error);
      });
    }
  });

  next();
}

export function trackLLMUsage(tokens: number, model?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as { tenantId?: string }).tenantId;

    if (!tenantId) {
      return next();
    }

    res.on('finish', () => {
      if (res.statusCode === 200) {
        const requestId = (req.headers['x-request-id'] as string) || uuidv4();

        usageEmitter
          .emitLLMTokens(tenantId, tokens, requestId, model, getEvidenceLink(requestId))
          .catch((error) => {
            logger.error('Failed to emit LLM usage', error);
          });
      }
    });

    next();
  };
}

export function trackAgentExecution(agentType?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as { tenantId?: string }).tenantId;

    if (!tenantId) {
      return next();
    }

    res.on('finish', () => {
      if (res.statusCode === 200) {
        const requestId = (req.headers['x-request-id'] as string) || uuidv4();

        usageEmitter
          .emitAgentExecution(tenantId, requestId, agentType, getEvidenceLink(requestId))
          .catch((error) => {
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
