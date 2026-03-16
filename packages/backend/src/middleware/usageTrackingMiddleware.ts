import { createLogger } from '@shared/lib/logger';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { supabase } from '../lib/supabase.js';
import UsageEmitter from '../services/metering/UsageEmitter.js';

const logger = createLogger({ component: 'UsageTrackingMiddleware' });
const usageEmitter = new UsageEmitter(supabase);

// Evidence links are useful for audit/trust portal stitching
const getEvidenceLink = (requestId: string): string => `api://${requestId}`;

function resolveUsageEvidence(
  req: Request,
  requestId: string
): {
  requestId: string;
  agentUuid: string;
  workloadIdentity: string;
  evidenceLink: string;
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

  const evidenceLink = getEvidenceLink(requestId);

  if (!requestId || !agentUuid || !workloadIdentity) {
    throw new Error(
      'Missing usage evidence fields: requestId, agentUuid, workloadIdentity are required'
    );
  }

  return { requestId, agentUuid, workloadIdentity, evidenceLink };
}

/**
 * Track API calls
 */
export function trackAPICall(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.tenantId;

  if (!tenantId) {
    return next();
  }

  res.on('finish', () => {
    // Only count non-5xx responses (treat 4xx as billable if they represent usage)
    if (res.statusCode < 500) {
      const requestId = (req.headers['x-request-id'] as string) || uuidv4();
      const endpoint = req.path;

      try {
        const evidence = resolveUsageEvidence(req, requestId);
        usageEmitter
          .emitAPICall(
            tenantId,
            evidence.requestId,
            endpoint,
            evidence.evidenceLink,
            evidence.agentUuid,
            evidence.workloadIdentity
          )
          .catch((error) => {
            logger.error('Failed to emit API call', error);
          });
      } catch (error) {
        logger.error(
          'Rejected API usage event missing evidence fields',
          error as Error
        );
      }
    }
  });

  next();
}

export function trackLLMUsage(tokens: number, model?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return next();
    }

    res.on('finish', () => {
      if (res.statusCode === 200) {
        const requestId = (req.headers['x-request-id'] as string) || uuidv4();

        try {
          const evidence = resolveUsageEvidence(req, requestId);
          usageEmitter
            .emitLLMTokens(
              tenantId,
              tokens,
              evidence.requestId,
              model,
              evidence.evidenceLink,
              evidence.agentUuid,
              evidence.workloadIdentity
            )
            .catch((error) => {
              logger.error('Failed to emit LLM usage', error);
            });
        } catch (error) {
          logger.error(
            'Rejected LLM usage event missing evidence fields',
            error as Error
          );
        }
      }
    });

    next();
  };
}

export function trackAgentExecution(agentType?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return next();
    }

    res.on('finish', () => {
      if (res.statusCode === 200) {
        const requestId = (req.headers['x-request-id'] as string) || uuidv4();

        try {
          const evidence = resolveUsageEvidence(req, requestId);
          usageEmitter
            .emitAgentExecution(
              tenantId,
              evidence.requestId,
              agentType,
              evidence.evidenceLink,
              evidence.agentUuid,
              evidence.workloadIdentity
            )
            .catch((error) => {
              logger.error('Failed to emit agent execution', error);
            });
        } catch (error) {
          logger.error(
            'Rejected agent usage event missing evidence fields',
            error as Error
          );
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
