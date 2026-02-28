import { Request, Response, Router } from 'express';

import { getEnvVar } from '../lib/env';
import { logger } from '../lib/logger';
import { validateRequest } from '../middleware/inputValidation';
import { rateLimiters } from '../middleware/rateLimiter';
import { requirePermission } from '../middleware/rbac';
import { requestSanitizationMiddleware } from '../middleware/requestSanitizationMiddleware';
import { securityHeadersMiddleware } from '../middleware/securityMiddleware';

const router = Router();
router.use(securityHeadersMiddleware);
router.use(requestSanitizationMiddleware({ params: { runId: { maxLength: 128 } } }));
router.use(requirePermission('agents.execute'));

const getGroundtruthConfig = () => {
  const baseUrl =
    getEnvVar('GROUNDTRUTH_API_URL') ||
    getEnvVar('VITE_GROUNDTRUTH_API_URL');
  const apiKey =
    getEnvVar('GROUNDTRUTH_API_KEY') ||
    getEnvVar('GROUNDTRUTH_API_TOKEN') ||
    getEnvVar('VITE_GROUNDTRUTH_API_KEY');

  return { baseUrl, apiKey };
};

const buildAuthHeaders = (apiKey?: string): Record<string, string> => {
  if (!apiKey) {
    return {};
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey,
  };
};

const buildRequestIdHeader = (res: Response): Record<string, string> => {
  const requestId = res.locals.requestId as string | undefined;
  return requestId ? { 'x-request-id': requestId } : {};
};

async function callGroundtruthApi(
  res: Response,
  path: string,
  payload: Record<string, unknown>
) {
  const { baseUrl, apiKey } = getGroundtruthConfig();

  if (!baseUrl) {
    logger.error('Groundtruth API URL is not configured');
    return res.status(503).json({
      error: 'Groundtruth API unavailable',
      message: 'Groundtruth API URL is not configured',
    });
  }

  const url = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(apiKey),
        ...buildRequestIdHeader(res),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Groundtruth API request failed', undefined, {
        path,
        status: response.status,
        body: errorBody,
      });

      return res.status(response.status).json({
        error: 'Groundtruth API request failed',
        message: errorBody || response.statusText,
      });
    }

    const data = await response.json();
    return res.json({ success: true, data });
  } catch (error) {
    logger.error('Groundtruth API request failed', error instanceof Error ? error : undefined, {
      path,
    });

    return res.status(500).json({
      error: 'Groundtruth API request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

router.post(
  '/financials',
  rateLimiters.agentExecution,
  validateRequest({
    entityId: { type: 'string' as const, required: true, maxLength: 64 },
    metrics: { type: 'array' as const },
    period: { type: 'string' as const, maxLength: 20 },
    includeIndustryBenchmarks: { type: 'boolean' as const },
  }),
  async (req: Request, res: Response) => {
    const { entityId, metrics, period, includeIndustryBenchmarks } = req.body;

    return callGroundtruthApi(res, 'financials', {
      entityId,
      metrics,
      period,
      includeIndustryBenchmarks,
    });
  }
);

router.post(
  '/benchmarks',
  rateLimiters.agentExecution,
  validateRequest({
    industryCode: { type: 'string' as const, required: true, maxLength: 10 },
    metrics: { type: 'array' as const, required: true },
  }),
  async (req: Request, res: Response) => {
    const { industryCode, metrics } = req.body;

    return callGroundtruthApi(res, 'benchmarks', {
      industryCode,
      metrics,
    });
  }
);

router.post(
  '/verify',
  rateLimiters.agentExecution,
  validateRequest({
    entityId: { type: 'string' as const, required: true, maxLength: 64 },
    metric: { type: 'string' as const, required: true, maxLength: 64 },
    value: { type: 'number' as const, required: true },
    period: { type: 'string' as const, maxLength: 20 },
  }),
  async (req: Request, res: Response) => {
    const { entityId, metric, value, period } = req.body;

    return callGroundtruthApi(res, 'verify', {
      entityId,
      metric,
      value,
      period,
    });
  }
);

router.use((err: unknown, _req: Request, res: Response) => {
  logger.error('Groundtruth endpoint failed', err instanceof Error ? err : undefined);
  res.status(500).json({
    error: 'groundtruth_error',
    message: 'Unable to complete groundtruth request',
  });
});

export default router;
