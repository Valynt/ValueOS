/**
 * Usage Tracking Middleware
 * Emits usage events after requests complete
 */

import { createLogger } from '@shared/lib/logger';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import UsageEmitter from '../services/metering/UsageEmitter';

const logger = createLogger({ component: 'UsageTrackingMiddleware' });

function resolveUsageEvidence(req: Request, requestId: string): {
  requestId: string;
  agentUuid: string;
  workloadIdentity: string;
} {
  const agentUuid =
    (req.header('x-agent-uuid') as string | undefined) ||
    process.env.USAGE_EMITTER_AGENT_UUID ||
    '';
  const workloadIdentity =
    (req.header('x-spiffe-id') as string | undefined) ||
    (req.header('x-service-principal') as string | undefined) ||
    process.env.USAGE_EMITTER_WORKLOAD_IDENTITY ||
    '';

  if (!requestId || !agentUuid || !workloadIdentity) {
    throw new Error('Missing usage evidence fields: requestId, agentUuid, workloadIdentity are required');
  }

  return { requestId, agentUuid, workloadIdentity };
}

/**
 * Track API calls
 */
export function trackAPICall(req: Request, res: Response, next: NextFunction) {
  const tenantId = (req as any).tenantId;

  if (!tenantId) {
    return next();
  }

  // Track on response finish
  res.on('finish', () => {
    if (res.statusCode < 500) {
      // Only count successful requests
      const requestId = (req.headers['x-request-id'] as string) || uuidv4();
      const endpoint = req.path;

      try {
        const evidence = resolveUsageEvidence(req, requestId);
        UsageEmitter.emitAPICall(
          tenantId,
          evidence.requestId,
          evidence.agentUuid,
          evidence.workloadIdentity,
          endpoint
        ).catch((error) => {
          logger.error('Failed to emit API call', error);
        });
      } catch (error) {
        logger.error('Rejected API usage event missing evidence fields', error as Error);
      }
    }
  });

  next();
}

/**
 * Track LLM usage from response
 */
export function trackLLMUsage(tokens: number, model?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return next();
    }

    res.on('finish', () => {
      if (res.statusCode === 200) {
        const requestId = (req.headers['x-request-id'] as string) || uuidv4();

        try {
          const evidence = resolveUsageEvidence(req, requestId);
          UsageEmitter.emitLLMTokens(
            tenantId,
            tokens,
            evidence.requestId,
            evidence.agentUuid,
            evidence.workloadIdentity,
            model
          ).catch((error) => {
            logger.error('Failed to emit LLM usage', error);
          });
        } catch (error) {
          logger.error('Rejected LLM usage event missing evidence fields', error as Error);
        }
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
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      return next();
    }

    res.on('finish', () => {
      if (res.statusCode === 200) {
        const requestId = (req.headers['x-request-id'] as string) || uuidv4();

        try {
          const evidence = resolveUsageEvidence(req, requestId);
          UsageEmitter.emitAgentExecution(
            tenantId,
            evidence.requestId,
            evidence.agentUuid,
            evidence.workloadIdentity,
            agentType
          ).catch((error) => {
            logger.error('Failed to emit agent execution', error);
          });
        } catch (error) {
          logger.error('Rejected agent usage event missing evidence fields', error as Error);
        }
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
