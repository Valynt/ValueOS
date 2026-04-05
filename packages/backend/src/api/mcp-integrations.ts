import { getRequestSupabaseClient } from '@shared/lib/supabase';
import type { Request, Response, Router } from 'express';
import { z } from 'zod';

import { createLogger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createSecureRouter } from '../middleware/secureRouter';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { McpIntegrationService } from '../services/mcp-integration/McpIntegrationService';
import {
  McpConfigurePayloadSchema,
  McpFailureReasonCodeSchema,
  McpIntegrationProviderSchema,
} from '../services/mcp-integration/types';
import { getMcpSyncQueue, getMcpValidationQueue } from '../workers/mcpIntegrationWorker.js';

const logger = createLogger({ component: 'McpIntegrationsAPI' });
const router: Router = createSecureRouter('strict');
const McpDisablePayloadSchema = z.object({
  reasonCode: McpFailureReasonCodeSchema.optional(),
});

router.use(requireAuth, tenantContextMiddleware());

function getTenantId(req: Request): string {
  if (!req.tenantId) {
    throw new Error('Tenant context is required');
  }
  return req.tenantId;
}

function getUserId(req: Request): string {
  if (!req.user?.id) {
    throw new Error('Authenticated user is required');
  }
  return req.user.id;
}

function getProvider(req: Request) {
  return McpIntegrationProviderSchema.parse(req.params.provider);
}

function getService(req: Request): McpIntegrationService {
  return new McpIntegrationService(getRequestSupabaseClient(req));
}

function handleError(res: Response, error: unknown): Response {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Invalid request payload', details: error.flatten() });
  }

  logger.error('MCP integration request failed', error instanceof Error ? error : undefined);
  return res.status(500).json({ error: error instanceof Error ? error.message : 'Request failed' });
}

const configureHandler = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const payload = McpConfigurePayloadSchema.parse(req.body ?? {});

    const service = getService(req);
    const integration = await service.configure(tenantId, userId, payload);

    const validationQueue = getMcpValidationQueue();
    const syncQueue = getMcpSyncQueue();

    const validationJob = await validationQueue.add('mcp:validation', {
      tenantId,
      provider: payload.provider,
      integrationId: integration.id,
    });

    const syncJob = await syncQueue.add('mcp:sync', {
      tenantId,
      provider: payload.provider,
      integrationId: integration.id,
    });

    await service.updateQueuedJobs(
      tenantId,
      payload.provider,
      {
        validationJobId: validationJob.id ? String(validationJob.id) : undefined,
        syncJobId: syncJob.id ? String(syncJob.id) : undefined,
      },
      userId
    );

    return res.status(201).json({
      integration,
      jobs: {
        validationJobId: validationJob.id,
        syncJobId: syncJob.id,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

router.post('/configure', requirePermission('integrations:manage'), configureHandler);
router.post('/connect', requirePermission('integrations:manage'), configureHandler);

router.post('/:provider/test-access', requirePermission('integrations:manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const provider = getProvider(req);
    const result = await getService(req).testAccess(tenantId, provider);
    return res.json({ result });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:provider/status', requirePermission('integrations:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const provider = getProvider(req);
    const integration = await getService(req).getStatus(tenantId, provider);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    return res.json({ integration });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/:provider/health', requirePermission('integrations:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const provider = getProvider(req);
    const health = await getService(req).getHealth(tenantId, provider);
    return res.json({ health });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:provider/reauthorize', requirePermission('integrations:manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const provider = getProvider(req);

    const service = getService(req);
    await service.reauthorize(tenantId, userId, provider);

    const integration = await service.getStatus(tenantId, provider);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const validationJob = await getMcpValidationQueue().add('mcp:validation', {
      tenantId,
      provider,
      integrationId: integration.id,
    });

    await service.updateQueuedJobs(
      tenantId,
      provider,
      { validationJobId: validationJob.id ? String(validationJob.id) : undefined },
      userId
    );

    return res.json({ ok: true, validationJobId: validationJob.id });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:provider/disable', requirePermission('integrations:manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const provider = getProvider(req);
    const disablePayload = McpDisablePayloadSchema.parse(req.body ?? {});
    const reasonCode = disablePayload.reasonCode ?? 'disabled_by_admin';

    await getService(req).disable(tenantId, userId, provider, reasonCode);
    return res.json({ ok: true, provider, reasonCode });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/:provider/disconnect', requirePermission('integrations:manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const provider = getProvider(req);

    await getService(req).disconnect(tenantId, userId, provider);
    return res.json({ ok: true, provider });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/audit/history', requirePermission('integrations:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const provider = req.query.provider
      ? McpIntegrationProviderSchema.parse(req.query.provider)
      : undefined;

    const history = await getService(req).listAuditHistory(tenantId, provider);
    return res.json({ history });
  } catch (error) {
    return handleError(res, error);
  }
});

router.get('/failures/history', requirePermission('integrations:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const provider = req.query.provider
      ? McpIntegrationProviderSchema.parse(req.query.provider)
      : undefined;

    const history = await getService(req).listFailureHistory(tenantId, provider);
    return res.json({ history });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
